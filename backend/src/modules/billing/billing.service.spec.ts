import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { BillingService } from "./billing.service";

interface SubRow {
  id: string;
  companyId: string;
  endDate: Date;
  plan: { name: string; priceMonthly: unknown };
  company: {
    name: string;
    memberships: { user: { id: string; email: string } }[];
  };
}

function subRow(overrides: Partial<SubRow> = {}): SubRow {
  return {
    id: "sub-1",
    companyId: "c1",
    endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    plan: { name: "Pro", priceMonthly: 50 },
    company: {
      name: "Demo",
      memberships: [{ user: { id: "u1", email: "admin@demo.com" } }],
    },
    ...overrides,
  };
}

function makeService(prisma: any) {
  const notifications: any[] = [];
  const notificationsSvc = {
    create: async (input: any) => {
      notifications.push(input);
      return {};
    },
  } as any;
  const email = { sendEmailDirect: async () => {} } as any;
  return {
    svc: new BillingService(prisma, notificationsSvc, email),
    notifications,
  };
}

describe("BillingService.getBillingStatus", () => {
  it("returns null when there is no subscription", async () => {
    const { svc } = makeService({
      subscription: { findFirst: async () => null },
    });

    assert.equal(await svc.getBillingStatus("c1"), null);
  });

  it("maps the latest subscription, pending payment and last successful payment", async () => {
    const prisma = {
      subscription: {
        findFirst: async () => ({
          id: "s1",
          status: "ACTIVE",
          plan: { name: "Pro" },
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-02-01"),
          autoRenew: true,
          billingCycle: "MONTHLY",
          payments: [
            {
              id: "p1",
              amount: 50,
              status: "SUCCEEDED",
              paidAt: new Date(),
              createdAt: new Date(),
            },
            {
              id: "p2",
              amount: 50,
              status: "PENDING",
              paidAt: null,
              createdAt: new Date(),
            },
          ],
          paymentProofs: [],
        }),
      },
    };
    const { svc } = makeService(prisma);

    const status = await svc.getBillingStatus("c1");

    assert.ok(status);
    assert.equal(status!.subscription.id, "s1");
    assert.equal(status!.currentPending?.id, "p2");
    assert.equal(status!.lastPayment?.id, "p1");
    assert.equal(status!.recentPayments.length, 2);
  });
});

describe("BillingService.createPendingPayments (via billing cycle)", () => {
  it("creates a pending payment and notifies the admin when none exists", async () => {
    const created: any[] = [];
    const prisma: any = {
      subscription: { findMany: async (args: any) => [subRow()] },
      payment: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          created.push(data);
          return data;
        },
      },
    };
    // all other cycle queries return empty
    prisma.subscription.findMany = async () => [subRow()];
    const { svc, notifications } = makeService(prisma);

    await (svc as any).createPendingPayments();

    assert.equal(created.length, 1);
    assert.equal(created[0].companyId ?? created[0].subscriptionId, "sub-1");
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].userId, "u1");
  });

  it("skips when there is already a pending payment", async () => {
    const created: any[] = [];
    const prisma: any = {
      subscription: { findMany: async () => [subRow()] },
      payment: {
        findFirst: async () => ({ id: "existing" }),
        create: async ({ data }: any) => {
          created.push(data);
          return data;
        },
      },
    };
    const { svc, notifications } = makeService(prisma);

    await (svc as any).createPendingPayments();

    assert.equal(created.length, 0);
    assert.equal(notifications.length, 0);
  });
});

describe("BillingService.processBillingCycle", () => {
  it("aggregates all sub-steps and reports counts", async () => {
    const prisma: any = {
      subscription: { findMany: async () => [] },
      payment: { findFirst: async () => null, create: async () => ({}) },
      $transaction: async (fn: any) => fn({}),
    };
    const { svc } = makeService(prisma);
    (svc as any).createPendingPayments = async () => 1;
    (svc as any).markPastDue = async () => 2;
    (svc as any).suspendOverdue = async () => 3;
    (svc as any).processExpiredTrials = async () => 4;
    (svc as any).notifyExpiringTrials = async () => 5;

    const results = await svc.processBillingCycle();

    assert.deepEqual(results, {
      pendingPaymentsCreated: 1,
      markedPastDue: 2,
      suspended: 3,
      expiredTrials: 4,
      trialRemindersSent: 5,
    });
  });
});
