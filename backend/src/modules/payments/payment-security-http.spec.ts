import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import { PrismaService } from "@/database/prisma/prisma.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthController } from "@/modules/auth/auth.controller";
import { AuthService } from "@/modules/auth/auth.service";
import { JwtStrategy } from "@/modules/auth/jwt.strategy";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

const secret = "http-regression-secret-not-for-production";

describe("Payment and identity HTTP security", () => {
  let app: INestApplication;
  let url: string;
  let confirmations = 0;
  let disabled = false;
  let revoked = false;
  let authVersion = 0;
  const jwt = new JwtService({ secret });
  const token = (role: string, claimedRoles: string[] = [role]) =>
    jwt.sign(
      {
        sub: role,
        email: "user@example.invalid",
        companyId:
          role === "SUPER_ADMIN" || role === "SUPPORT_ADMIN" ? null : "company",
        roles: claimedRoles,
        sid: "family",
      },
      { expiresIn: "15m" },
    );

  before(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: "jwt" })],
      controllers: [PaymentsController, AuthController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: async ({ where }: { where: { id: string } }) => ({
                id: where.id,
                email: "user@example.invalid",
                fullName: "User",
                isActive: !disabled,
                authVersion,
                globalRole: ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(where.id)
                  ? where.id
                  : "USER",
                employee: null,
                refreshTokens: revoked ? [] : [{ id: "session" }],
                memberships: ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(where.id)
                  ? []
                  : [
                      {
                        role: where.id,
                        company: {
                          id: "company",
                          status: "ACTIVE",
                          trialEndsAt: null,
                          subscriptions: [],
                        },
                      },
                    ],
              }),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            changePassword: async () => ({ message: "changed" }),
            resetPassword: async () => ({ message: "reset" }),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            markAsPaid: async () => {
              confirmations++;
              return { id: "payment", message: "confirmed" };
            },
          },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
  });

  after(async () => {
    await app?.close();
  });

  it("invalidates an old access token after a credential-version change", async () => {
    const headers = { Authorization: `Bearer ${token("CASHIER")}` };
    authVersion = 1;
    assert.equal((await fetch(`${url}/auth/me`, { headers })).status, 401);
    authVersion = 0;
  });

  it("clears authentication cookies after successful password changes and resets", async () => {
    for (const [path, body] of [
      [
        "change-password",
        { oldPassword: "old-password", newPassword: "new-password" },
      ],
      ["reset-password", { token: "reset-token", password: "new-password" }],
    ] as const) {
      const response = await fetch(`${url}/auth/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token("CASHIER")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 200);
      const cookies = response.headers.getSetCookie();
      assert.ok(
        cookies.some(
          (cookie) =>
            cookie.startsWith("access_token=") && cookie.includes("Max-Age=0"),
        ),
      );
      assert.ok(
        cookies.some(
          (cookie) =>
            cookie.startsWith("refresh_token=") && cookie.includes("Max-Age=0"),
        ),
      );
    }
  });

  it("denies unauthenticated, company, cashier, manager and support actors before confirmation", async () => {
    for (const role of [
      null,
      "COMPANY_ADMIN",
      "MANAGER",
      "CASHIER",
      "SUPPORT_ADMIN",
    ]) {
      const response = await fetch(`${url}/payments/payment/mark-paid`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(role ? { Authorization: `Bearer ${token(role)}` } : {}),
        },
        body: JSON.stringify({ reason: "manual check" }),
      });
      assert.equal(response.status, role ? 403 : 401);
    }
    assert.equal(confirmations, 0);
  });

  it("allows a SUPER_ADMIN without tenant context and validates the confirmation reason", async () => {
    const headers = {
      Authorization: `Bearer ${token("SUPER_ADMIN")}`,
      "Content-Type": "application/json",
    };
    const invalid = await fetch(`${url}/payments/payment/mark-paid`, {
      method: "PATCH",
      headers,
      body: "{}",
    });
    assert.equal(invalid.status, 400);
    const valid = await fetch(`${url}/payments/payment/mark-paid`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ reason: "bank receipt verified" }),
    });
    assert.equal(valid.status, 200);
    assert.equal(confirmations, 1);
  });

  it("ignores a stale elevated role in a correctly signed token", async () => {
    const response = await fetch(`${url}/payments/payment/mark-paid`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token("CASHIER", ["SUPER_ADMIN"])}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "forged role" }),
    });
    assert.equal(response.status, 403);
    assert.equal(confirmations, 1);
  });

  it("returns a public /auth/me identity and immediately rejects disabled or revoked sessions", async () => {
    const headers = { Authorization: `Bearer ${token("CASHIER")}` };
    const valid = await fetch(`${url}/auth/me`, { headers });
    assert.equal(valid.status, 200);
    const identity = (await valid.json()) as Record<string, unknown>;
    assert.equal(identity.id, "CASHIER");
    assert.equal("sid" in identity, false);
    disabled = true;
    assert.equal((await fetch(`${url}/auth/me`, { headers })).status, 401);
    disabled = false;
    revoked = true;
    assert.equal((await fetch(`${url}/auth/me`, { headers })).status, 401);
    revoked = false;
  });
});
