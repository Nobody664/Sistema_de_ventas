import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PaymentSettingsService } from "./payment-settings.service";
import { SubscriptionSettlementService } from "./subscription-settlement.service";

function fixture(failure?: "activation" | "outbox") {
  const state = {
    proofStatus: "PENDING",
    paymentStatus: "PENDING",
    extensions: 0,
    active: false,
    audit: 0,
    events: 0,
  };
  const subscription = {
    id: "sub",
    companyId: "company",
    planId: "pro",
    billingCycle: "MONTHLY",
    status: "PAST_DUE",
    endDate: new Date(0),
    company: { status: "INACTIVE" },
  };
  const payment = () => ({
    id: "payment",
    amount: new Prisma.Decimal(100),
    currency: "PEN",
    provider: "CASH",
    status: state.paymentStatus,
    providerPayload: { planId: "pro", billingCycle: "MONTHLY" },
    subscription,
  });
  const tx = {
    user: { findFirst: async () => ({ id: "admin" }) },
    paymentProof: {
      findUnique: async () => ({
        id: "proof",
        subscriptionId: "sub",
        paymentId: "payment",
        amount: "100",
        paymentDate: new Date("2026-01-01"),
        imageBase64: "image",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: state.proofStatus,
        subscription,
      }),
      updateMany: async ({ data }: { data: { status: string } }) => {
        if (state.proofStatus !== "PENDING") return { count: 0 };
        state.proofStatus = data.status;
        return { count: 1 };
      },
    },
    payment: {
      findFirst: async () => payment(),
      findUnique: async () => payment(),
      updateMany: async () => {
        state.paymentStatus = "SUCCEEDED";
        return { count: 1 };
      },
    },
    subscription: {
      update: async () => {
        if (failure === "activation") throw new Error("activation failed");
        state.extensions++;
      },
    },
    company: {
      update: async () => {
        state.active = true;
      },
    },
    platformAuditLog: {
      create: async () => {
        state.audit++;
      },
    },
    outboxEvent: {
      upsert: async () => {
        if (failure === "outbox") throw new Error("outbox failed");
        state.events++;
      },
    },
  };
  const prisma = {
    $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => {
      const before = { ...state };
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    },
  } as unknown as PrismaService;
  const settlement = new SubscriptionSettlementService(
    prisma,
    {} as never,
    {} as never,
  );
  return { state, service: new PaymentSettingsService(prisma, settlement) };
}

describe("Proof review and settlement atomicity", () => {
  for (const failure of ["activation", "outbox"] as const) {
    it(`rolls back proof, payment, subscription, company and audit when ${failure} fails`, async () => {
      const value = fixture(failure);
      await assert.rejects(
        value.service.reviewProof("proof", "admin", {
          status: "APPROVED",
        } as never),
        new RegExp(`${failure} failed`),
      );
      assert.deepEqual(value.state, {
        proofStatus: "PENDING",
        paymentStatus: "PENDING",
        extensions: 0,
        active: false,
        audit: 0,
        events: 0,
      });
    });
  }
  it("commits approval and its durable event together, then returns the existing decision on retry", async () => {
    const value = fixture();
    await value.service.reviewProof("proof", "admin", {
      status: "APPROVED",
    } as never);
    const repeated = await value.service.reviewProof("proof", "admin", {
      status: "APPROVED",
    } as never);
    assert.equal(repeated.status, "APPROVED");
    assert.deepEqual(value.state, {
      proofStatus: "APPROVED",
      paymentStatus: "SUCCEEDED",
      extensions: 1,
      active: true,
      audit: 1,
      events: 1,
    });
  });
});
