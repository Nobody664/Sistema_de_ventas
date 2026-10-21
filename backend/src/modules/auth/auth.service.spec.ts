import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { UnauthorizedException } from "@nestjs/common";
import { RefreshTokenType } from "@prisma/client";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";

async function makeUser() {
  return {
    id: "u1",
    email: "admin@demo.com",
    fullName: "Admin",
    passwordHash: await argon2.hash("secreta123"),
    globalRole: "USER",
  };
}

function makeService(overrides: {
  prisma?: any;
  usersService?: any;
  jwtService?: any;
  configService?: any;
  emailService?: any;
}) {
  const prisma = overrides.prisma ?? {};
  const usersService = overrides.usersService ?? {};
  const jwtService = overrides.jwtService ?? {
    signAsync: async () => "access-token",
  };
  const configService = overrides.configService ?? {
    get: () => undefined,
    getOrThrow: (key: string) =>
      key === "JWT_ACCESS_TTL" ? "15m" : "test-secret",
  };
  const emailService = overrides.emailService ?? {};
  return new AuthService(
    prisma,
    usersService,
    jwtService,
    configService,
    emailService,
  );
}

describe("AuthService.login", () => {
  it("rejects an unknown email", async () => {
    const svc = makeService({
      usersService: { findByEmail: async () => null },
    });

    await assert.rejects(
      () => svc.login({ email: "x@x.com", password: "y" } as any),
      UnauthorizedException,
    );
  });

  it("rejects a wrong password", async () => {
    const user = await makeUser();
    const svc = makeService({
      usersService: { findByEmail: async () => user },
    });

    await assert.rejects(
      () => svc.login({ email: user.email, password: "incorrecta" } as any),
      UnauthorizedException,
    );
  });

  it("rejects a SUSPENDED company", async () => {
    const user = await makeUser();
    const svc = makeService({
      usersService: { findByEmail: async () => user },
      prisma: {
        membership: {
          findFirst: async () => ({
            role: "COMPANY_ADMIN",
            companyId: "c1",
            company: { status: "SUSPENDED" },
          }),
        },
      },
    });

    await assert.rejects(
      () => svc.login({ email: user.email, password: "secreta123" } as any),
      UnauthorizedException,
    );
  });

  it("creates a session with plan code and subscription status", async () => {
    const user = await makeUser();
    let capturedClaims: any;
    let createdToken: any;
    const svc = makeService({
      usersService: { findByEmail: async () => user },
      prisma: {
        membership: {
          findFirst: async () => ({
            role: "COMPANY_ADMIN",
            companyId: "c1",
            company: { status: "ACTIVE" },
          }),
        },
        subscription: {
          findFirst: async () => ({ status: "ACTIVE", plan: { code: "PRO" } }),
        },
        company: {
          findUnique: async () => ({
            status: "ACTIVE",
            trialEndsAt: null,
          }),
        },
        refreshToken: {
          create: async ({ data }: any) => {
            createdToken = data;
            return data;
          },
        },
      },
      jwtService: {
        signAsync: async (claims: any) => {
          capturedClaims = claims;
          return "access-token";
        },
      },
    });

    const session = await svc.login({
      email: user.email,
      password: "secreta123",
    } as any);

    assert.equal(session.accessToken, "access-token");
    assert.equal(typeof session.refreshToken, "string");
    assert.equal(session.refreshToken.length, 128);
    assert.equal(session.user.companyId, "c1");
    assert.equal(session.user.planCode, "PRO");
    assert.equal(session.user.subscriptionStatus, "ACTIVE");
    assert.deepEqual(session.user.roles, ["USER", "COMPANY_ADMIN"]);
    assert.equal(createdToken.type, RefreshTokenType.SESSION);
  });
});

describe("AuthService.refresh", () => {
  it("requires a token", async () => {
    const svc = makeService({});

    await assert.rejects(() => svc.refresh(), UnauthorizedException);
  });

  it("rejects an unknown token", async () => {
    const svc = makeService({
      prisma: { refreshToken: { findUnique: async () => null } },
    });

    await assert.rejects(() => svc.refresh("unknown"), UnauthorizedException);
  });

  it("revokes the whole family when a revoked token is reused", async () => {
    let revokedFamily: any;
    const svc = makeService({
      prisma: {
        refreshToken: {
          findUnique: async () => ({
            id: "t1",
            userId: "u1",
            familyId: "fam-1",
            type: RefreshTokenType.SESSION,
            revokedAt: new Date(),
          }),
          updateMany: async (args: any) => {
            revokedFamily = args.where;
            return { count: 2 };
          },
        },
      },
    });

    await assert.rejects(() => svc.refresh("revoked"), UnauthorizedException);
    assert.deepEqual(revokedFamily, { familyId: "fam-1", revokedAt: null });
  });

  it("rotates the refresh token inside a transaction", async () => {
    const stored = {
      id: "t1",
      userId: "u1",
      familyId: "fam-1",
      companyId: "c1",
      type: RefreshTokenType.SESSION,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    const created: any[] = [];
    const updated: any[] = [];

    const svc = makeService({
      usersService: {
        findById: async () => ({
          id: "u1",
          email: "a@a.com",
          fullName: "Admin",
          globalRole: "USER",
        }),
      },
      prisma: {
        refreshToken: { findUnique: async () => stored },
        membership: {
          findFirst: async () => ({ role: "COMPANY_ADMIN", companyId: "c1" }),
        },
        subscription: {
          findFirst: async () => ({ status: "ACTIVE", plan: { code: "PRO" } }),
        },
        company: {
          findUnique: async () => ({
            status: "ACTIVE",
            trialEndsAt: null,
          }),
        },
        $transaction: async (fn: any) =>
          fn({
            refreshToken: {
              create: async ({ data }: any) => created.push(data),
              update: async ({ where, data }: any) =>
                updated.push({ where, data }),
            },
          }),
      },
      jwtService: { signAsync: async () => "new-access" },
    });

    const result = await svc.refresh("valid", "1.2.3.4", "jest");

    assert.equal(result.accessToken, "new-access");
    assert.equal(typeof result.refreshToken, "string");
    assert.equal(created.length, 1);
    assert.equal(created[0].familyId, "fam-1");
    assert.equal(created[0].ipAddress, "1.2.3.4");
    assert.equal(updated.length, 1);
    assert.equal(updated[0].where.id, "t1");
    assert.ok(updated[0].data.revokedAt instanceof Date);
    assert.equal(updated[0].data.replacedBy, created[0].tokenHash);
  });
});
