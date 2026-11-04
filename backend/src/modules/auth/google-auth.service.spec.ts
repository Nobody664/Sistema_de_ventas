import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { GoogleAuthService } from "./google-auth.service";
import type { GoogleTokenVerifier } from "./google-token.verifier";

function makeAuthService() {
  const user = {
    id: "user-1",
    email: "persona@gmail.com",
    fullName: "Persona",
    passwordHash: "hash",
    globalRole: "USER",
    isActive: true,
    authVersion: 0,
    avatarUrl: null,
    employee: null,
  };
  const refreshTokens: unknown[] = [];
  const prisma = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work(prisma),
    user: { findFirst: async () => ({ id: user.id }) },
    membership: {
      findFirst: async () => ({
        role: "COMPANY_ADMIN",
        companyId: "company-1",
        company: { status: "ACTIVE" },
      }),
    },
    subscription: {
      findFirst: async () => ({ status: "ACTIVE", plan: { code: "GROWTH" } }),
    },
    company: {
      findUnique: async () => ({ status: "ACTIVE", trialEndsAt: null }),
    },
    refreshToken: {
      create: async ({ data }: { data: unknown }) => {
        refreshTokens.push(data);
        return data;
      },
    },
  };
  const service = new AuthService(
    prisma as never,
    { findByEmail: async () => user } as never,
    { signAsync: async () => "access-token" } as never,
    {
      get: () => undefined,
      getOrThrow: (key: string) =>
        key === "JWT_ACCESS_TTL" ? "15m" : "test-secret",
    } as never,
    {} as never,
  );
  return { service, user, refreshTokens };
}

describe("GoogleAuthService", () => {
  it("intercambia la identidad verificada por una sesión de la aplicación", async () => {
    const { service, user } = makeAuthService();
    let receivedEmail: string | undefined;
    const authService = {
      loginWithVerifiedEmail: async (email: string) => {
        receivedEmail = email;
        return {
          accessToken: "access",
          refreshToken: "refresh",
          expiresIn: "15m",
          user: { id: user.id, email: user.email },
        };
      },
    };
    const verifier = {
      verify: async () => ({ email: "persona@gmail.com" }),
    } as unknown as GoogleTokenVerifier;

    const google = new GoogleAuthService(verifier, authService as never);
    const session = await google.login("google-credential");

    assert.equal(receivedEmail, "persona@gmail.com");
    assert.equal(session.accessToken, "access");
  });

  it("no crea sesión si el token de Google no es válido", async () => {
    let called = false;
    const verifier = {
      verify: async () => {
        throw new UnauthorizedException("token inválido");
      },
    } as unknown as GoogleTokenVerifier;
    const authService = {
      loginWithVerifiedEmail: async () => {
        called = true;
        return {};
      },
    };
    const google = new GoogleAuthService(verifier, authService as never);

    await assert.rejects(
      () => google.login("credential"),
      UnauthorizedException,
    );
    assert.equal(called, false);
  });
});

describe("AuthService.loginWithVerifiedEmail", () => {
  it("crea una sesión sin pedir contraseña cuando el correo está verificado", async () => {
    const { service, user, refreshTokens } = makeAuthService();
    const session = await service.loginWithVerifiedEmail("persona@gmail.com");

    assert.equal(session.user.id, user.id);
    assert.deepEqual(session.user.roles, ["USER", "COMPANY_ADMIN"]);
    assert.equal(session.user.companyId, "company-1");
    assert.equal(refreshTokens.length, 1);
  });

  it("rechaza correos sin una cuenta activa", async () => {
    const noUser = new AuthService(
      {
        $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
          work({}),
      } as never,
      { findByEmail: async () => null } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await assert.rejects(
      () => noUser.loginWithVerifiedEmail("desconocido@gmail.com"),
      UnauthorizedException,
    );
  });
});
