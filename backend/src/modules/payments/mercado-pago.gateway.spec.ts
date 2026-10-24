import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadGatewayException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MercadoPagoGateway } from "./mercado-pago.gateway";

const config = { get: () => "test-only-token" } as unknown as ConfigService;

describe("MercadoPago gateway boundary", () => {
  it("uses only the fixed HTTPS API with authentication and validates the returned payment", async (context) => {
    context.mock.method(
      globalThis,
      "fetch",
      async (url: string, init: RequestInit) => {
        assert.equal(url, "https://api.mercadopago.com/v1/payments/1234");
        assert.equal(
          (init.headers as Record<string, string>).Authorization,
          "Bearer test-only-token",
        );
        assert.equal(init.redirect, "error");
        assert.ok(init.signal);
        return Response.json({
          id: 1234,
          status: "approved",
          transaction_amount: 50,
          currency_id: "PEN",
          collector_id: 999,
          external_reference: "mp-reference",
          date_approved: "2026-10-01T12:00:00Z",
          live_mode: true,
        });
      },
    );
    const payment = await new MercadoPagoGateway(config).getPayment("1234");
    assert.equal(payment.id, "1234");
    assert.equal(payment.collectorId, "999");
    assert.equal(payment.paidAt?.toISOString(), "2026-10-01T12:00:00.000Z");
  });

  it("does not accept arbitrary lookup URLs or incomplete provider responses", async (context) => {
    let requests = 0;
    context.mock.method(globalThis, "fetch", async () => {
      requests++;
      return Response.json({ status: "approved" });
    });
    const gateway = new MercadoPagoGateway(config);
    await assert.rejects(
      gateway.getPayment("https://example.invalid/file"),
      BadGatewayException,
    );
    assert.equal(requests, 0);
    await assert.rejects(gateway.getPayment("1234"), BadGatewayException);
    assert.equal(requests, 1);
  });

  it("verifies the merchant from the server credential and briefly caches that identity", async (context) => {
    let requests = 0;
    context.mock.method(globalThis, "fetch", async (url: string) => {
      requests++;
      assert.equal(url, "https://api.mercadopago.com/users/me");
      return Response.json({ id: 999 });
    });
    const gateway = new MercadoPagoGateway(config);
    assert.equal(await gateway.getMerchantId(), "999");
    assert.equal(await gateway.getMerchantId(), "999");
    assert.equal(requests, 1);
  });

  it("returns a retryable error when the provider cannot be verified", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
      throw new Error("network unavailable");
    });
    await assert.rejects(
      new MercadoPagoGateway(config).getPayment("1234"),
      BadGatewayException,
    );
  });
});
