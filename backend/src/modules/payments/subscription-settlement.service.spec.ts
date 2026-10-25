import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CacheService } from "@/cache/cache.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { SubscriptionSettlementService } from "./subscription-settlement.service";
import { MercadoPagoPayment } from "./mercado-pago.gateway";
import { subscriptionEndDate } from "@/common/helpers/subscription-period.helper";

const admin = {
  sub: "admin",
  email: "admin@example.invalid",
  roles: ["SUPER_ADMIN"],
};
const verified: MercadoPagoPayment = {
  id: "1234",
  status: "approved",
  amount: 50,
  currency: "PEN",
  reference: "mp-reference",
  collectorId: "merchant",
  liveMode: true,
  paidAt: new Date(),
};

function fixture() {
  const state = {
    status: "PENDING",
    provider: "CASH",
    providerPaymentId: null as string | null,
    extensions: 0,
    audit: 0,
    activeCompany: false,
    companyStatus: "ACTIVE",
  };
  let failSubscription = false;
  let authorizedReviewer = true;
  let txCount = 0;
  const tx = {
    outboxEvent: { upsert: async () => ({}) },
    user: {
      findFirst: async () => (authorizedReviewer ? { id: "admin" } : null),
    },
    payment: {
      findUnique: async () => ({
        id: "payment",
        status: state.status,
        provider: state.provider,
        providerPaymentId: state.providerPaymentId,
        currency: "PEN",
        amount: new Prisma.Decimal(50),
        providerPayload: {
          kind: "MERCADOPAGO_CHECKOUT",
          companyId: "company",
          planId: "pro",
          billingCycle: "MONTHLY",
        },
        subscription: {
          id: "subscription",
          companyId: "company",
          planId: "pro",
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2027-01-31T12:00:00Z"),
          company: { status: state.companyStatus },
        },
      }),
      updateMany: async ({
        data,
      }: {
        data: { status: string; providerPaymentId: string };
      }) => {
        if (state.status !== "PENDING") return { count: 0 };
        state.status = data.status;
        state.providerPaymentId = data.providerPaymentId;
        return { count: 1 };
      },
    },
    subscription: {
      update: async () => {
        if (failSubscription) throw new Error("database failure");
        state.extensions++;
      },
    },
    company: {
      update: async () => {
        state.activeCompany = true;
      },
    },
    platformAuditLog: {
      create: async () => {
        state.audit++;
      },
    },
  };
  let queue = Promise.resolve();
  const prisma = {
    $transaction: <T>(
      work: (client: typeof tx) => Promise<T>,
      options: { isolationLevel: string },
    ): Promise<T> => {
      assert.equal(options.isolationLevel, "Serializable");
      const result = queue.then(async () => {
        txCount++;
        const snapshot = { ...state };
        try {
          return await work(tx);
        } catch (error) {
          Object.assign(state, snapshot);
          throw error;
        }
      });
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
  const service = new SubscriptionSettlementService(
    prisma as unknown as PrismaService,
    { invalidate: async () => undefined } as unknown as PlanCapabilitiesService,
    { del: async () => undefined } as unknown as CacheService,
  );
  return {
    state,
    service,
    setFail: () => {
      failSubscription = true;
    },
    revokeReviewer: () => {
      authorizedReviewer = false;
    },
    get transactions() {
      return txCount;
    },
  };
}

describe("Subscription settlements", () => {
  it("rejects company administrators before any transaction", async () => {
    const fixtureValue = fixture();
    await assert.rejects(
      fixtureValue.service.confirmManual(
        "payment",
        { ...admin, roles: ["COMPANY_ADMIN"] },
        { reason: "confirmed" },
      ),
      ForbiddenException,
    );
    assert.equal(fixtureValue.transactions, 0);
  });

  it("checks that the platform reviewer still has the required role", async () => {
    const value = fixture();
    value.revokeReviewer();
    await assert.rejects(
      value.service.confirmManual("payment", admin, {
        reason: "bank received",
      }),
      ForbiddenException,
    );
    assert.equal(value.state.status, "PENDING");
  });

  it("confirms and audits only once under two simultaneous manual requests", async () => {
    const value = fixture();
    const results = await Promise.all([
      value.service.confirmManual("payment", admin, {
        reason: "bank received",
      }),
      value.service.confirmManual("payment", admin, {
        reason: "bank received",
      }),
    ]);
    assert.equal(value.state.extensions, 1);
    assert.equal(value.state.audit, 1);
    assert.equal(results.filter((result) => result.alreadyProcessed).length, 1);
  });

  it("rolls back the payment status if subscription activation fails", async () => {
    const value = fixture();
    value.setFail();
    await assert.rejects(
      value.service.confirmManual("payment", admin, {
        reason: "bank received",
      }),
      /database failure/,
    );
    assert.equal(value.state.status, "PENDING");
    assert.equal(value.state.audit, 0);
  });

  it("cannot manually confirm a MercadoPago intention", async () => {
    const value = fixture();
    value.state.provider = "MERCADOPAGO";
    await assert.rejects(
      value.service.confirmManual("payment", admin, {
        reason: "bank received",
      }),
      BadRequestException,
    );
  });

  it("does not lift an administrative suspension just because a payment was received", async () => {
    const value = fixture();
    value.state.companyStatus = "SUSPENDED";
    await value.service.confirmManual("payment", admin, {
      reason: "bank receipt verified",
    });
    assert.equal(value.state.extensions, 1);
    assert.equal(value.state.activeCompany, false);
  });

  it("rejects mismatched online amounts and currency without changing the pending intention", async () => {
    const value = fixture();
    value.state.provider = "MERCADOPAGO";
    await assert.rejects(
      value.service.confirmMercadoPago({ ...verified, amount: 1 }),
      BadRequestException,
    );
    await assert.rejects(
      value.service.confirmMercadoPago({ ...verified, currency: "USD" }),
      BadRequestException,
    );
    assert.equal(value.state.status, "PENDING");
  });

  it("accepts duplicate delivery of the same verified payment without extending twice", async () => {
    const value = fixture();
    value.state.provider = "MERCADOPAGO";
    await value.service.confirmMercadoPago(verified);
    const duplicate = await value.service.confirmMercadoPago(verified);
    assert.equal(duplicate.alreadyProcessed, true);
    assert.equal(value.state.extensions, 1);
    await assert.rejects(
      value.service.confirmMercadoPago({
        ...verified,
        id: "different-payment",
      }),
      ConflictException,
    );
  });

  it("clamps renewal dates at month/year boundaries", () => {
    assert.equal(
      subscriptionEndDate(
        new Date("2027-01-31T12:00:00Z"),
        "MONTHLY",
      ).toISOString(),
      "2027-02-28T12:00:00.000Z",
    );
    assert.equal(
      subscriptionEndDate(
        new Date("2024-02-29T12:00:00Z"),
        "YEARLY",
      ).toISOString(),
      "2025-02-28T12:00:00.000Z",
    );
  });
});
