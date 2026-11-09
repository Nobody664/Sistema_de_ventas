import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StoreAdminPolicyService } from "./store-admin-policy.service";

const policy = new StoreAdminPolicyService();

function order(overrides: Record<string, unknown> = {}) {
  return {
    status: "CONFIRMED",
    paymentStatus: "PAID",
    fulfillment: "UNFULFILLED",
    saleId: "sale-1",
    expiresAt: new Date("2026-11-10T12:00:00Z"),
    snapshot: {
      currency: "PEN",
      payment: {
        id: "cash",
        code: "CASH_ON_PICKUP",
        label: "Pago al retirar",
        instructions: "",
      },
      shipping: {
        id: "pickup",
        kind: "PICKUP",
        label: "Retiro",
        pickupAddress: "Av. Principal 100",
      },
      address: null,
      buyer: {
        firstName: "Ana",
        lastName: "Pérez",
        documentValue: "12345678",
        phone: "999999999",
      },
      lines: [
        {
          productId: "product-1",
          presentationId: null,
          name: "Producto",
          presentationName: null,
          quantity: "1",
          factor: "1",
          baseQuantity: "1",
          unitPrice: "10",
          totalPrice: "10",
        },
      ],
      subtotal: "10",
      taxAmount: "0",
      shippingAmount: "0",
      totalAmount: "10",
    },
    ...overrides,
  };
}

describe("StoreAdminPolicyService", () => {
  it("solo habilita gestión completa con empresa activa y módulo de tienda", () => {
    assert.equal(
      policy.mode({ companyStatus: "ACTIVE", storefrontModule: true }),
      "MANAGE",
    );
    assert.equal(
      policy.mode({ companyStatus: "TRIAL", storefrontModule: true }),
      "MANAGE",
    );
    assert.equal(
      policy.mode({ companyStatus: "ACTIVE", storefrontModule: false }),
      "CLOSEOUT",
    );
    assert.equal(
      policy.mode({ companyStatus: "PAST_DUE", storefrontModule: true }),
      "CLOSEOUT",
    );
  });

  it("mantiene atención existente pero cierra configuración en modo restringido", () => {
    const manage = policy.capabilities("MANAGE");
    const closeout = policy.capabilities("CLOSEOUT");
    assert.equal(manage.viewDashboard, true);
    assert.equal(manage.manageCatalog, true);
    assert.equal(closeout.viewDashboard, false);
    assert.equal(closeout.manageCatalog, false);
    assert.equal(closeout.attendExistingOrders, true);
  });

  it("deriva las acciones permitidas sin inventar transiciones", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    assert.deepEqual(policy.allowedActions(order(), now), ["PREPARE"]);

    assert.deepEqual(
      policy.allowedActions(
        order({
          paymentStatus: "PENDING",
          saleId: null,
          fulfillment: "PREPARING",
          snapshot: {
            ...order().snapshot,
            shipping: {
              ...order().snapshot.shipping,
              kind: "DELIVERY",
            },
          },
        }),
        now,
      ),
      ["APPROVE_PAYMENT", "EXTEND", "SHIP", "CANCEL"],
    );

    assert.deepEqual(
      policy.allowedActions(
        order({ status: "CANCELLED", paymentStatus: "REFUNDED" }),
        now,
      ),
      [],
    );

    assert.deepEqual(
      policy.allowedActions(
        order({
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refund: { status: "SUCCEEDED", restockedAt: null },
        }),
        now,
      ),
      ["RESTOCK"],
    );
  });

  it("no ofrece aprobación manual para pagos de pasarela", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    assert.deepEqual(
      policy.allowedActions(
        order({
          paymentStatus: "UNDER_REVIEW",
          saleId: null,
          snapshot: {
            ...order().snapshot,
            payment: {
              ...order().snapshot.payment,
              code: "MERCADOPAGO",
            },
          },
        }),
        now,
      ),
      ["REJECT_PROOF", "EXTEND", "CANCEL"],
    );
  });

  it("no permite entregar efectivo al retirar mientras el cobro siga pendiente", () => {
    const actions = policy.allowedActions(
      order({
        paymentStatus: "PENDING",
        saleId: null,
        fulfillment: "READY_FOR_PICKUP",
      }),
      new Date("2026-11-08T12:00:00Z"),
    );
    assert.equal(actions.includes("DELIVER"), false);
    assert.equal(actions.includes("APPROVE_PAYMENT"), true);
  });
});
