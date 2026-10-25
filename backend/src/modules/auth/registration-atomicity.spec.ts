import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuthService } from "./auth.service";

function fixture(mode: "success" | "missing-plan" | "session-failure") {
  const state = {
    company: 0,
    subscription: 0,
    owner: 0,
    membership: 0,
    token: 0,
    transactions: 0,
  };
  const tx = {
    plan: {
      findUnique: async () =>
        mode === "missing-plan"
          ? null
          : {
              id: "free",
              code: "FREE",
              isActive: true,
              billingCycle: "MONTHLY",
            },
    },
    user: {
      findUnique: async () => null,
      findFirst: async () => (state.owner ? { id: "owner" } : null),
      create: async () => {
        state.owner++;
        state.membership++;
        return {
          id: "owner",
          email: "u@example.invalid",
          fullName: "User",
          authVersion: 0,
        };
      },
    },
    company: {
      create: async () => {
        state.company++;
        return { id: "company" };
      },
      findUnique: async () => ({ status: "TRIAL", trialEndsAt: new Date() }),
    },
    subscription: {
      create: async () => {
        state.subscription++;
        return { status: "TRIALING" };
      },
    },
    refreshToken: {
      create: async () => {
        state.token++;
        if (mode === "session-failure") throw new Error("session write failed");
        return {};
      },
    },
  };
  const prisma = {
    $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => {
      state.transactions++;
      assert.equal(state.transactions, 1);
      const before = { ...state };
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    },
  } as unknown as PrismaService;
  const service = new AuthService(
    prisma,
    {} as never,
    { signAsync: async () => "access" } as unknown as JwtService,
    {
      get: () => "15m",
      getOrThrow: () => "test-config",
    } as unknown as ConfigService,
    {} as never,
  );
  return {
    state,
    register: () =>
      service.register({
        companyName: "Empresa",
        fullName: "User",
        email: "u@example.invalid",
        password: "test-password",
      }),
  };
}

describe("Registration atomicity", () => {
  it("creates company, subscription, owner, membership and session in exactly one transaction", async () => {
    const value = fixture("success");
    const session = await value.register();
    assert.equal(session.user.id, "owner");
    assert.deepEqual(value.state, {
      company: 1,
      subscription: 1,
      owner: 1,
      membership: 1,
      token: 1,
      transactions: 1,
    });
  });
  it("does not create an orphan company when the plan is missing", async () => {
    const value = fixture("missing-plan");
    await assert.rejects(value.register(), BadRequestException);
    assert.equal(value.state.company, 0);
    assert.equal(value.state.owner, 0);
  });
  it("rolls back all domain records when session creation fails at the end", async () => {
    const value = fixture("session-failure");
    await assert.rejects(value.register(), /session write failed/);
    assert.equal(value.state.company, 0);
    assert.equal(value.state.owner, 0);
    assert.equal(value.state.membership, 0);
    assert.equal(value.state.subscription, 0);
    assert.equal(value.state.token, 0);
  });
});
