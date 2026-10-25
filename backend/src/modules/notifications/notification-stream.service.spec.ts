import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EventEmitter } from "node:events";
import { setImmediate as nextTurn } from "node:timers/promises";
import { Response } from "express";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationStreamService } from "./notification-stream.service";
import { AuthUser } from "@/common/decorators/current-user.decorator";

function fixture() {
  let active = true;
  let subscribed = 0;
  const prisma = {
    user: {
      findUnique: async () => ({
        isActive: active,
        authVersion: 0,
        globalRole: "USER",
        employee: null,
        refreshTokens: active ? [{ id: "session" }] : [],
        memberships: [{ role: "COMPANY_ADMIN" }],
      }),
    },
  } as unknown as PrismaService;
  const service = new NotificationStreamService(prisma, {
    subscribe: () => {
      subscribed++;
      return () => {
        subscribed--;
      };
    },
  } as never);
  const user: AuthUser = {
    sub: "user",
    email: "u@example.invalid",
    sid: "family",
    companyId: "company",
    authVersion: 0,
    tokenExpiresAt: Date.now() + 600000,
    roles: ["USER", "COMPANY_ADMIN"],
  };
  const response = () => {
    const emitter = new EventEmitter();
    const chunks: string[] = [];
    const state = Object.assign(emitter, {
      writableEnded: false,
      headersSent: false,
      setHeader: () => undefined,
      flushHeaders: () => {
        state.headersSent = true;
      },
      write: (data: string) => {
        chunks.push(data);
        return true;
      },
      end: () => {
        state.writableEnded = true;
      },
    });
    return { value: state as unknown as Response, state, chunks };
  };
  return {
    service,
    user,
    response,
    revoke: () => {
      active = false;
    },
    get subscribed() {
      return subscribed;
    },
  };
}

describe("Notification stream lifecycle", () => {
  it("closes a long-lived credential stream after five minutes", async (context) => {
    context.mock.timers.enable({
      apis: ["setTimeout", "setInterval", "Date"],
      now: Date.now(),
    });
    const value = fixture();
    const response = value.response();
    await value.service.open(value.user, response.value);
    context.mock.timers.tick(300000);
    await nextTurn();
    assert.equal(response.state.writableEnded, true);
    assert.equal(value.subscribed, 0);
  });
  it("closes a slow client instead of building an unbounded write buffer", async (context) => {
    const value = fixture();
    const response = value.response();
    context.mock.method(response.state, "write", () => false);
    await value.service.open(value.user, response.value);
    assert.equal(response.state.writableEnded, true);
    assert.equal(value.subscribed, 0);
  });
  it("sends heartbeats and closes on session revocation while removing subscriptions", async (context) => {
    context.mock.timers.enable({
      apis: ["setTimeout", "setInterval", "Date"],
      now: Date.now(),
    });
    const value = fixture();
    const response = value.response();
    await value.service.open(value.user, response.value);
    assert.equal(value.subscribed, 1);
    context.mock.timers.tick(15000);
    await nextTurn();
    assert.ok(response.chunks.includes(": heartbeat\n\n"));
    value.revoke();
    context.mock.timers.tick(15000);
    await nextTurn();
    assert.equal(response.state.writableEnded, true);
    assert.equal(value.subscribed, 0);
  });
  it("enforces expiry even before the next heartbeat", async (context) => {
    context.mock.timers.enable({
      apis: ["setTimeout", "setInterval", "Date"],
      now: Date.now(),
    });
    const value = fixture();
    value.user.tokenExpiresAt = Date.now() + 1000;
    const response = value.response();
    await value.service.open(value.user, response.value);
    context.mock.timers.tick(1000);
    assert.equal(response.state.writableEnded, true);
    assert.equal(value.subscribed, 0);
  });
  it("caps streams per user and releases slots after disconnect", async () => {
    const value = fixture();
    const responses = [value.response(), value.response(), value.response()];
    try {
      for (const response of responses)
        await value.service.open(value.user, response.value);
      await assert.rejects(
        value.service.open(value.user, value.response().value),
        { status: 429 },
      );
      responses[0].state.emit("close");
      assert.equal(value.subscribed, 2);
      await value.service.open(value.user, value.response().value);
      assert.equal(value.subscribed, 3);
    } finally {
      value.service.onModuleDestroy();
    }
    assert.equal(value.subscribed, 0);
  });
  it("rejects expired credentials and does not reserve a leaked connection slot", async () => {
    const value = fixture();
    value.user.tokenExpiresAt = Date.now() - 1;
    await assert.rejects(
      value.service.open(value.user, value.response().value),
      { status: 401 },
    );
    assert.equal(value.subscribed, 0);
  });
});
