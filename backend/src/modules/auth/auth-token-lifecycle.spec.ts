import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "crypto";
import * as argon2 from "argon2";
import { PrismaService } from "@/database/prisma/prisma.service";
import { UsersService } from "@/modules/users/users.service";
import { EmailService } from "@/modules/email/email.service";
import { AuthService } from "./auth.service";

interface TokenRow {
  id: string; userId: string; companyId: string | null; tokenHash: string; familyId: string;
  type: "SESSION" | "RESET"; authVersion: number; expiresAt: Date; revokedAt: Date | null; replacedBy: string | null;
}

async function fixture() {
  const user = { id: "user", email: "user@example.invalid", fullName: "User", globalRole: "USER", isActive: true, employee: null, authVersion: 0, passwordHash: await argon2.hash("old-password") };
  const tokens: TokenRow[] = [];
  let failRevocation = false;
  const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
  const add = (raw: string, type: TokenRow["type"]) => {
    const row: TokenRow = { id: `token-${tokens.length}`, userId: user.id, companyId: type === "SESSION" ? "company" : null, tokenHash: hash(raw), familyId: `family-${tokens.length}`, type, authVersion: user.authVersion, expiresAt: new Date(Date.now() + 60_000), revokedAt: null, replacedBy: null };
    tokens.push(row); return row;
  };
  type Filter = { id?: string; userId?: string; companyId?: string | null; tokenHash?: string; familyId?: string; type?: TokenRow["type"]; authVersion?: number; revokedAt?: null; expiresAt?: { gt: Date } };
  const matches = (row: TokenRow, where: Filter) => Object.entries(where).every(([key, value]) => key === "expiresAt" ? row.expiresAt > (value as { gt: Date }).gt : row[key as keyof TokenRow] === value);
  const tx = {
    user: {
      findUnique: async () => ({ ...user }),
      findFirst: async ({ where }: { where: { authVersion: number } }) => user.isActive && user.authVersion === where.authVersion ? { id: user.id } : null,
      updateMany: async ({ where, data }: { where: { authVersion?: number; passwordHash?: string; isActive?: boolean }; data: { passwordHash?: string; authVersion?: { increment: number } } }) => {
        if ((where.authVersion !== undefined && where.authVersion !== user.authVersion) || (where.passwordHash !== undefined && where.passwordHash !== user.passwordHash) || (where.isActive && !user.isActive)) return { count: 0 };
        if (data.passwordHash) user.passwordHash = data.passwordHash;
        user.authVersion += data.authVersion?.increment ?? 0;
        return { count: 1 };
      },
    },
    refreshToken: {
      findUnique: async ({ where }: { where: Filter }) => { const row = tokens.find((value) => matches(value, where)); return row ? { ...row } : null; },
      create: async ({ data }: { data: Omit<TokenRow, "id" | "revokedAt" | "replacedBy"> }) => { const row = { ...data, id: `new-${tokens.length}`, revokedAt: null, replacedBy: null }; tokens.push(row); return row; },
      updateMany: async ({ where, data }: { where: Filter; data: { revokedAt: Date; replacedBy?: string } }) => {
        if (failRevocation && !where.id) throw new Error("revocation write failed");
        let count = 0;
        for (const row of tokens) if (matches(row, where)) { row.revokedAt = data.revokedAt; if (data.replacedBy) row.replacedBy = data.replacedBy; count++; }
        return { count };
      },
    },
    membership: { findFirst: async () => ({ userId: user.id, companyId: "company", role: "CASHIER" }) },
    subscription: { findFirst: async () => ({ status: "ACTIVE", plan: { code: "PRO" } }) },
    company: { findUnique: async () => ({ status: "ACTIVE", trialEndsAt: null }) },
  };
  let queue = Promise.resolve();
  const prisma = { ...tx, $transaction: <T>(work: (client: typeof tx) => Promise<T>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable");
    const result = queue.then(async () => {
      const oldUser = { ...user }; const oldTokens = structuredClone(tokens);
      try { return await work(tx); } catch (error) { Object.assign(user, oldUser); tokens.splice(0, tokens.length, ...oldTokens); throw error; }
    });
    queue = result.then(() => undefined, () => undefined); return result;
  } };
  const service = new AuthService(prisma as unknown as PrismaService, { findById: async () => ({ ...user }), findByEmail: async () => ({ ...user }) } as unknown as UsersService,
    { signAsync: async () => "signed-access" } as unknown as JwtService,
    { get: () => undefined, getOrThrow: () => "test-config" } as unknown as ConfigService, {} as EmailService);
  return { service, user, tokens, add, failRevoke: () => { failRevocation = true; } };
}

describe("Atomic token lifecycle", () => {
  it("consumes a reset token once under competing requests and advances the identity version", async () => {
    const value = await fixture(); value.add("reset", "RESET"); value.add("session", "SESSION");
    const results = await Promise.allSettled([value.service.resetPassword("reset", "new-password-a"), value.service.resetPassword("reset", "new-password-b")]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(value.user.authVersion, 1);
    assert.ok(value.tokens.every((row) => row.revokedAt));
    await assert.rejects(value.service.resetPassword("reset", "another-password"), BadRequestException);
  });

  it("rolls back password, token consumption and version if session revocation fails", async () => {
    const value = await fixture(); value.add("reset", "RESET"); value.add("session", "SESSION"); value.failRevoke();
    const oldPassword = value.user.passwordHash;
    await assert.rejects(value.service.resetPassword("reset", "new-password"), /revocation write failed/);
    assert.equal(value.user.passwordHash, oldPassword);
    assert.equal(value.user.authVersion, 0);
    assert.ok(value.tokens.every((row) => row.revokedAt === null));
  });

  it("rejects a reset token from a previous credential version without changing the password", async () => {
    const value = await fixture(); value.add("reset", "RESET"); value.user.authVersion = 1;
    const oldPassword = value.user.passwordHash;
    await assert.rejects(value.service.resetPassword("reset", "new-password"), BadRequestException);
    assert.equal(value.user.passwordHash, oldPassword);
  });

  it("revokes sibling reset tokens as well as sessions after changing a password", async () => {
    const value = await fixture(); value.add("reset-a", "RESET"); value.add("reset-b", "RESET"); value.add("session", "SESSION");
    await value.service.changePassword(value.user.id, "old-password", "new-password");
    assert.equal(value.user.authVersion, 1);
    assert.ok(value.tokens.every((row) => row.revokedAt));
    await assert.rejects(value.service.resetPassword("reset-b", "bad-password"), BadRequestException);
  });

  it("rotates a refresh once and revokes its replacement on replay of the consumed token", async () => {
    const value = await fixture(); value.add("refresh", "SESSION");
    const first = await value.service.refresh("refresh");
    assert.equal(first.accessToken, "signed-access");
    assert.equal(value.tokens.filter((row) => !row.revokedAt).length, 1);
    await assert.rejects(value.service.refresh("refresh"), UnauthorizedException);
    assert.ok(value.tokens.every((row) => row.revokedAt));
  });

  it("does not leave a live replacement when logout competes with refresh", async () => {
    const value = await fixture(); value.add("refresh", "SESSION");
    await Promise.allSettled([value.service.refresh("refresh"), value.service.logout("refresh")]);
    assert.equal(value.tokens.filter((row) => !row.revokedAt).length, 0);
  });

  it("rejects refresh tokens whose credential version is no longer current", async () => {
    const value = await fixture(); value.add("refresh", "SESSION"); value.user.authVersion = 1;
    await assert.rejects(value.service.refresh("refresh"), UnauthorizedException);
    assert.ok(value.tokens.every((row) => row.revokedAt));
  });
});
