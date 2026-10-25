import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { ConflictException } from "@nestjs/common";
import { OutboxEvent, Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { OutboxService } from "./outbox.service";

function fixture() {
  const state: OutboxEvent = {
    id: "event",
    dedupeKey: "PAYMENT_CONFIRMED:payment",
    kind: "PAYMENT_CONFIRMED",
    aggregateId: "payment",
    attempts: 0,
    availableAt: new Date(0),
    lockedAt: null,
    leaseToken: null,
    processedAt: null,
    lastError: null,
    createdAt: new Date(0),
  };
  let enabled = true;
  let fail = false;
  let sent = 0;
  let audit = 0;
  let afterSend: (() => void) | undefined;
  const notifications = new Set<string>();
  const messageIds: string[] = [];
  const company = {
    name: "Empresa",
    memberships: [{ user: { id: "owner", email: "owner@example.invalid" } }],
  };
  const prisma = {
    outboxEvent: {
      findMany: async () =>
        state.processedAt === null &&
        state.attempts < 10 &&
        state.availableAt <= new Date() &&
        (!state.lockedAt || state.lockedAt.getTime() < Date.now() - 120000)
          ? [{ ...state }]
          : [],
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (
          state.processedAt ||
          (where.leaseToken !== undefined &&
            where.leaseToken !== state.leaseToken)
        )
          return { count: 0 };
        if (
          where.OR &&
          state.lockedAt &&
          state.lockedAt.getTime() >= Date.now() - 120000
        )
          return { count: 0 };
        const { attempts, ...fields } = data;
        Object.assign(state, fields);
        if (attempts !== undefined)
          state.attempts =
            typeof attempts === "number" ? attempts : state.attempts + 1;
        return { count: 1 };
      },
    },
    payment: {
      findUnique: async () => ({
        status: "SUCCEEDED",
        currency: "PEN",
        amount: new Prisma.Decimal(10),
        subscription: {
          companyId: "company",
          company: {
            name: "Empresa",
            memberships: [
              { user: { id: "owner", email: "owner@example.invalid" } },
            ],
          },
        },
      }),
    },
    checkoutRequest: {
      findUnique: async () => ({
        email: "",
        companyId: "company",
        companyName: "Empresa",
        status: "APPROVED",
        company,
        plan: { name: "Pro" },
      }),
    },
    planUpgradeRequest: {
      findUnique: async () => ({
        companyId: "company",
        status: "REJECTED",
        company,
        plan: { name: "Pro" },
      }),
    },
    platformAuditLog: {
      create: async () => {
        audit++;
      },
    },
    $transaction: async <T>(work: (tx: object) => Promise<T>) => work(prisma),
  };
  const worker = () =>
    new OutboxService(
      prisma as unknown as PrismaService,
      {
        create: async (input: { dedupeKey: string }) => {
          notifications.add(input.dedupeKey);
        },
        notifySuperAdmins: async (input: { dedupeKey: string }) => {
          notifications.add(input.dedupeKey);
        },
      } as never,
      {
        sendEmailDirect: async (input: { messageId: string }) => {
          messageIds.push(input.messageId);
          if (fail) throw new Error("SMTP unavailable");
          sent++;
          afterSend?.();
        },
      } as never,
      {} as never,
      { invalidate: async () => undefined } as never,
      { del: async () => undefined } as never,
      { get: () => enabled } as unknown as ConfigService,
    );
  return {
    state,
    worker,
    notifications,
    messageIds,
    setEnabled: (value: boolean) => {
      enabled = value;
    },
    setFail: (value: boolean) => {
      fail = value;
    },
    afterSend: (hook: () => void) => {
      afterSend = hook;
    },
    get sent() {
      return sent;
    },
    get audit() {
      return audit;
    },
  };
}

describe("Transactional outbox delivery", () => {
  for (const kind of [
    "CHECKOUT_SUBMITTED",
    "CHECKOUT_REVIEWED",
    "UPGRADE_REVIEWED",
  ]) {
    it(`delivers ${kind} using projected active owners and completes the event`, async () => {
      const value = fixture();
      value.state.kind = kind;
      await value.worker().processPending();
      assert.equal(value.sent, 1);
      assert.ok(value.state.processedAt);
      assert.equal(
        value.notifications.size,
        kind === "CHECKOUT_SUBMITTED" ? 1 : 2,
      );
    });
  }
  it("claims an event with compare-and-set so concurrent workers only deliver once", async () => {
    const value = fixture();
    await Promise.all([
      value.worker().processPending(),
      value.worker().processPending(),
    ]);
    assert.equal(value.sent, 1);
    assert.equal(value.state.attempts, 1);
    assert.ok(value.state.processedAt);
    assert.equal(value.state.leaseToken, null);
  });
  it("persists an SMTP failure for retry, deduplicates in-app notifications and uses a stable Message-ID", async () => {
    const value = fixture();
    value.setFail(true);
    await value.worker().processPending();
    assert.equal(value.state.processedAt, null);
    assert.equal(value.state.lastError, "DELIVERY_FAILED");
    assert.ok(value.state.availableAt > new Date());
    assert.equal(value.state.lockedAt, null);
    value.state.availableAt = new Date(0);
    value.setFail(false);
    await value.worker().processPending();
    assert.equal(value.state.attempts, 2);
    assert.equal(value.sent, 1);
    assert.equal(value.notifications.size, 2);
    assert.equal(value.messageIds[0], value.messageIds[1]);
    assert.ok(value.state.processedAt);
  });
  it("does not mark email as delivered when SMTP is disabled", async () => {
    const value = fixture();
    value.setEnabled(false);
    await value.worker().processPending();
    assert.equal(value.sent, 0);
    assert.equal(value.state.processedAt, null);
    assert.equal(value.state.lastError, "DELIVERY_FAILED");
    assert.equal(value.notifications.size, 2);
  });
  it("recovers stale leases and leaves a live lease untouched", async () => {
    const value = fixture();
    value.state.lockedAt = new Date();
    value.state.leaseToken = "live";
    await value.worker().processPending();
    assert.equal(value.sent, 0);
    value.state.lockedAt = new Date(Date.now() - 121000);
    await value.worker().processPending();
    assert.equal(value.sent, 1);
    assert.ok(value.state.processedAt);
  });
  it("does not acknowledge another worker's lease after ownership is lost", async () => {
    const value = fixture();
    value.afterSend(() => {
      value.state.leaseToken = "replacement";
    });
    await value.worker().processPending();
    assert.equal(value.state.processedAt, null);
    assert.equal(value.state.leaseToken, "replacement");
  });
  it("stops automatic delivery after ten attempts and allows an audited manual retry", async () => {
    const value = fixture();
    value.state.attempts = 10;
    await value.worker().processPending();
    assert.equal(value.sent, 0);
    assert.deepEqual(await value.worker().retry("event", "admin"), {
      retryScheduled: true,
    });
    assert.equal(value.audit, 1);
    await value.worker().processPending();
    assert.equal(value.sent, 1);
    await assert.rejects(
      value.worker().retry("event", "admin"),
      ConflictException,
    );
  });
});
