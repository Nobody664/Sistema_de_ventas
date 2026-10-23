import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { NotFoundException } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";

function makeService(prisma: any) {
  const notificationsSvc = { create: async () => ({}) } as any;
  const email = {} as any;
  const invalidated: string[] = [];
  const planCapabilities = {
    invalidate: async (companyId: string) => {
      invalidated.push(companyId);
    },
  } as any;
  return {
    svc: new SubscriptionsService(
      prisma,
      notificationsSvc,
      email,
      planCapabilities,
    ),
    invalidated,
  };
}

describe("SubscriptionsService.checkLimit", () => {
  it("allows when there is no active subscription", async () => {
    const { svc } = makeService({
      subscription: { findFirst: async () => null },
    });

    assert.deepEqual(await svc.checkLimit("c1", "users"), {
      allowed: true,
      current: 0,
      limit: null,
    });
  });

  it("computes the users limit against the active plan", async () => {
    const prisma = {
      subscription: {
        findFirst: async () => ({ plan: { name: "Pro", maxUsers: 5 } }),
      },
      membership: { count: async () => 5 },
    };
    const { svc } = makeService(prisma);

    const result = await svc.checkLimit("c1", "users");

    assert.equal(result.allowed, false);
    assert.equal(result.limit, 5);
    assert.equal(result.current, 5);
    assert.equal(result.planName, "Pro");
  });

  it("computes the products limit against the active plan", async () => {
    const prisma = {
      subscription: {
        findFirst: async () => ({ plan: { name: "Pro", maxProducts: 100 } }),
      },
      product: { count: async () => 10 },
    };
    const { svc } = makeService(prisma);

    const result = await svc.checkLimit("c1", "products");

    assert.equal(result.allowed, true);
    assert.equal(result.limit, 100);
    assert.equal(result.current, 10);
  });
});

describe("SubscriptionsService.approveSubscriber", () => {
  it("404s for an unknown subscription", async () => {
    const { svc } = makeService({
      subscription: { findUnique: async () => null },
    });

    await assert.rejects(
      () => svc.approveSubscriber("sub-x"),
      NotFoundException,
    );
  });

  it("activates the subscription and company and invalidates capabilities", async () => {
    const prisma = {
      subscription: {
        findUnique: async () => ({
          id: "sub-1",
          companyId: "c1",
          company: {
            memberships: [{ user: { id: "u1", email: "a@a.com" } }],
          },
          plan: { name: "Pro" },
        }),
      },
      $transaction: async (fn: any) =>
        fn({
          subscription: {
            update: async () => ({ id: "sub-1", status: "ACTIVE" }),
          },
          company: { update: async () => ({}) },
        }),
    };
    const { svc, invalidated } = makeService(prisma);

    const result = await svc.approveSubscriber("sub-1");

    assert.equal(result.status, "ACTIVE");
    assert.deepEqual(invalidated, ["c1"]);
  });
});

describe("SubscriptionsService.processExpiredTrials", () => {
  it("expires trials, deactivates companies and invalidates capabilities", async () => {
    const prisma = {
      subscription: {
        findMany: async () => [
          {
            id: "sub-1",
            companyId: "c1",
            company: {
              memberships: [{ user: { id: "u1", email: "a@a.com" } }],
            },
            plan: { name: "Free" },
          },
        ],
      },
      $transaction: async (fn: any) =>
        fn({
          subscription: { update: async () => ({}) },
          company: { update: async () => ({}) },
        }),
    };
    const { svc, invalidated } = makeService(prisma);

    const result = await svc.processExpiredTrials();

    assert.deepEqual(result, { processed: 1 });
    assert.deepEqual(invalidated, ["c1"]);
  });
});

describe("SubscriptionsService.cancelSubscription", () => {
  it("404s when there is no subscription for the company", async () => {
    const { svc } = makeService({
      subscription: { findFirst: async () => null },
    });

    await assert.rejects(() => svc.cancelSubscription("c1"), NotFoundException);
  });

  it("cancels only the company's subscription and invalidates capabilities", async () => {
    let updateManyWhere: any;
    const prisma = {
      subscription: {
        findFirst: async () => ({ id: "sub-1", companyId: "c1" }),
        updateMany: async ({ where }: any) => {
          updateManyWhere = where;
          return { count: 1 };
        },
      },
    };
    const { svc, invalidated } = makeService(prisma);

    const result = await svc.cancelSubscription("c1");

    assert.equal(result.status, "CANCELED");
    assert.equal(result.autoRenew, false);
    assert.deepEqual(updateManyWhere, { id: "sub-1", companyId: "c1" });
    assert.deepEqual(invalidated, ["c1"]);
  });
});
