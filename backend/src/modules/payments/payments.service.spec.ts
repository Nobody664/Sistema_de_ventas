import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "crypto";
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PaymentsService } from "./payments.service";
import { MercadoPagoGateway, MercadoPagoPayment } from "./mercado-pago.gateway";
import { SubscriptionSettlementService } from "./subscription-settlement.service";

const SECRET = "webhook-test-secret";
const REQUEST_ID = "test-request-id";
const payment: MercadoPagoPayment = {
  id: "100500",
  status: "approved",
  amount: 50,
  currency: "PEN",
  collectorId: "merchant",
  reference: "mp-stored-reference",
  liveMode: true,
  paidAt: new Date(),
};

function signature(
  id = payment.id,
  timestamp = String(Math.floor(Date.now() / 1000)),
) {
  const v1 = createHmac("sha256", SECRET)
    .update(`id:${id.toLowerCase()};request-id:${REQUEST_ID};ts:${timestamp};`)
    .digest("hex");
  return {
    "x-signature": `ts=${timestamp},v1=${v1}`,
    "x-request-id": REQUEST_ID,
  };
}

function fixture(overrides: Record<string, string> = {}) {
  const config = {
    MERCADOPAGO_WEBHOOK_SECRET: SECRET,
    NODE_ENV: "test",
    ...overrides,
  };
  const verified = { ...payment };
  const settled: MercadoPagoPayment[] = [];
  let lookups = 0;
  const gateway = {
    getPayment: async () => {
      lookups++;
      return verified;
    },
    getMerchantId: async () => "merchant",
  };
  const settlement = {
    confirmMercadoPago: async (value: MercadoPagoPayment) => {
      settled.push(value);
      return { alreadyProcessed: false };
    },
  };
  const service = new PaymentsService(
    {
      get: (key: keyof typeof config) => config[key],
    } as unknown as ConfigService,
    {} as PrismaService,
    gateway as unknown as MercadoPagoGateway,
    settlement as unknown as SubscriptionSettlementService,
  );
  return {
    service,
    verified,
    settled,
    get lookups() {
      return lookups;
    },
  };
}

describe("MercadoPago verified notifications", () => {
  it("fails closed if signature configuration is missing", async () => {
    const value = fixture({ MERCADOPAGO_WEBHOOK_SECRET: "" });
    await assert.rejects(
      value.service.handleWebhook(
        "mercadopago",
        { type: "payment" },
        signature(),
        { "data.id": payment.id },
      ),
      ServiceUnavailableException,
    );
    assert.equal(value.lookups, 0);
  });

  it("rejects missing, malformed, expired signatures and changed request IDs before calling the provider", async () => {
    const value = fixture();
    for (const headers of [
      {},
      { ...signature(), "x-signature": "ts=0,v1=deadbeef" },
      signature(payment.id, "1000000000"),
      { ...signature(), "x-request-id": "another-request" },
    ]) {
      await assert.rejects(
        value.service.handleWebhook(
          "mercadopago",
          { type: "payment" },
          headers,
          { "data.id": payment.id },
        ),
        UnauthorizedException,
      );
    }
    assert.equal(value.lookups, 0);
  });

  it("rejects changing the signed resource or supplying conflicting parser representations", async () => {
    const value = fixture();
    await assert.rejects(
      value.service.handleWebhook(
        "mercadopago",
        { type: "payment" },
        signature(),
        { "data.id": "999" },
      ),
      UnauthorizedException,
    );
    await assert.rejects(
      value.service.handleWebhook(
        "mercadopago",
        { type: "payment" },
        signature(),
        { "data.id": payment.id, data: { id: "999" } },
      ),
      UnauthorizedException,
    );
    await assert.rejects(
      value.service.handleWebhook(
        "mercadopago",
        { type: "payment", data: { id: "999" } },
        signature(),
        { "data.id": payment.id },
      ),
      BadRequestException,
    );
    assert.equal(value.lookups, 0);
  });

  it("looks up the signed ID and ignores a forged approval and external reference in the body", async () => {
    const value = fixture();
    value.verified.status = "pending";
    const result = await value.service.handleWebhook(
      "mercadopago",
      {
        type: "payment",
        status: "approved",
        external_reference: "victim_EXPENSIVE",
        id: "forged",
      },
      signature(),
      { "data.id": payment.id },
    );
    assert.equal(result.processed, false);
    assert.equal(value.lookups, 1);
    assert.equal(value.settled.length, 0);
  });

  it("accepts nested data.id and passes only the authoritative provider payment to settlement", async () => {
    const value = fixture();
    const result = await value.service.handleWebhook(
      "mercadopago",
      { type: "payment", external_reference: "forged" },
      signature(),
      { data: { id: payment.id } },
    );
    assert.equal(result.processed, true);
    assert.equal(value.settled[0].reference, payment.reference);
  });

  it("supports millisecond timestamps and acknowledges unsupported topics without activating a subscription", async () => {
    const value = fixture();
    const result = await value.service.handleWebhook(
      "mercadopago",
      { type: "merchant_order" },
      signature(payment.id, String(Date.now())),
      { "data.id": payment.id },
    );
    assert.equal(result.processed, false);
    assert.equal(value.lookups, 0);
  });

  it("rejects a different beneficiary and sandbox payments in production", async () => {
    const wrongMerchant = fixture();
    wrongMerchant.verified.collectorId = "other-merchant";
    await assert.rejects(
      wrongMerchant.service.handleWebhook(
        "mercadopago",
        { type: "payment" },
        signature(),
        { "data.id": payment.id },
      ),
      BadRequestException,
    );
    const sandbox = fixture({ NODE_ENV: "production" });
    sandbox.verified.liveMode = false;
    await assert.rejects(
      sandbox.service.handleWebhook(
        "mercadopago",
        { type: "payment" },
        signature(),
        { "data.id": payment.id },
      ),
      BadRequestException,
    );
    assert.equal(sandbox.settled.length, 0);
  });

  it("does not report success for unimplemented providers", async () => {
    const value = fixture();
    await assert.rejects(
      value.service.handleWebhook("unknown", {}, {}, {}),
      BadRequestException,
    );
  });
});

describe("MercadoPago persisted checkout intention", () => {
  it("persists the expected amount, plan and company before requesting the preference", async () => {
    let stored: Record<string, unknown> | undefined;
    const prisma = {
      plan: {
        findUnique: async () => ({
          id: "pro",
          code: "PRO",
          name: "Pro",
          priceMonthly: 50,
          isActive: true,
        }),
      },
      company: {
        findUnique: async () => ({
          id: "company",
          email: "owner@example.invalid",
          subscriptions: [{ id: "subscription" }],
        }),
      },
      payment: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = data;
          return { id: "intention" };
        },
      },
    };
    const gateway = {
      createPreference: async (input: {
        reference: string;
        paymentId: string;
      }) => {
        assert.ok(stored);
        assert.equal(input.reference, stored.transactionId);
        assert.equal(input.paymentId, "intention");
        return {
          id: "preference",
          redirectUrl: "https://www.mercadopago.com.pe/checkout",
        };
      },
    };
    const service = new PaymentsService(
      { get: () => "test-configuration" } as unknown as ConfigService,
      prisma as unknown as PrismaService,
      gateway as unknown as MercadoPagoGateway,
      {} as SubscriptionSettlementService,
    );
    await service.createCheckoutSession({
      companyId: "company",
      planCode: "PRO",
      provider: "mercadopago",
    });
    assert.deepEqual(stored?.providerPayload, {
      kind: "MERCADOPAGO_CHECKOUT",
      companyId: "company",
      planId: "pro",
      billingCycle: "MONTHLY",
    });
    assert.equal(stored?.amount, "50");
  });
});
