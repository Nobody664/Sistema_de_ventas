import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { PrismaService } from "@/database/prisma/prisma.service";
import { JwtStrategy } from "./jwt.strategy";

function fixture() {
  const user = {
    id: "user",
    email: "user@example.invalid",
    fullName: "User",
    isActive: true,
    authVersion: 0,
    globalRole: "USER",
    employee: null as null | {
      companyId: string;
      isActive: boolean;
      deletedAt: Date | null;
    },
    refreshTokens: [{ id: "token" }],
    memberships: [
      {
        role: "CASHIER",
        company: {
          id: "company",
          status: "ACTIVE",
          trialEndsAt: null,
          subscriptions: [{ status: "ACTIVE", plan: { code: "PRO" } }],
        },
      },
    ],
  };
  const prisma = { user: { findUnique: async () => user } };
  const strategy = new JwtStrategy(
    { getOrThrow: () => "test-secret-with-length" } as unknown as ConfigService,
    prisma as unknown as PrismaService,
  );
  const payload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: ["SUPER_ADMIN"],
    companyId: "company",
    sid: "family",
  };
  return { user, strategy, payload };
}

describe("JWT current identity and session", () => {
  it("rejects an old credential version even if a session-family record remains", async () => {
    const { user, strategy, payload } = fixture();
    user.authVersion = 1;
    await assert.rejects(
      strategy.validate({} as Request, payload),
      UnauthorizedException,
    );
  });
  it("replaces stale token permissions with the current membership and returns the public session fields", async () => {
    const { strategy, payload } = fixture();
    const result = await strategy.validate({} as Request, payload);
    assert.deepEqual(result.roles, ["USER", "CASHIER"]);
    assert.equal(result.id, payload.sub);
    assert.equal(result.planCode, "PRO");
    assert.equal(result.subscriptionStatus, "ACTIVE");
  });

  it("rejects a disabled user even with a cryptographically valid token", async () => {
    const { user, strategy, payload } = fixture();
    user.isActive = false;
    await assert.rejects(
      strategy.validate({} as Request, payload),
      UnauthorizedException,
    );
  });

  it("rejects an access token whose refresh family was revoked", async () => {
    const { user, strategy, payload } = fixture();
    user.refreshTokens = [];
    await assert.rejects(
      strategy.validate({} as Request, payload),
      UnauthorizedException,
    );
  });

  it("does not preserve an old tenant after its membership was revoked", async () => {
    const { user, strategy, payload } = fixture();
    user.memberships = [];
    await assert.rejects(
      strategy.validate({} as Request, payload),
      UnauthorizedException,
    );
  });

  it("rejects an inactive employee from legacy data even if the membership is still active", async () => {
    const { user, strategy, payload } = fixture();
    user.employee = { companyId: "company", isActive: false, deletedAt: null };
    await assert.rejects(
      strategy.validate({} as Request, payload),
      UnauthorizedException,
    );
  });

  it("requires legacy access tokens to renew before accessing resources", async () => {
    const { strategy, payload } = fixture();
    await assert.rejects(
      strategy.validate({} as Request, { ...payload, sid: undefined }),
      UnauthorizedException,
    );
  });
});
