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
      ["APPROVE_PAYMENT", "EXTEND", "CANCEL"],
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
      ["EXTEND", "CANCEL"],
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

  it("permite reconocer un cobro tardío sin habilitar preparación de una venta inexistente", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    const expired = order({
      status: "EXPIRED",
      paymentStatus: "UNDER_REVIEW",
      saleId: null,
      expiresAt: new Date(0),
      reservations: [],
    });
    assert.equal(
      policy.allowedActions(expired, now).includes("APPROVE_PAYMENT"),
      true,
    );
    const latePaid = order({
      status: "REVIEW_REQUIRED",
      paymentStatus: "PAID",
      saleId: null,
      expiresAt: new Date(0),
      reservations: [],
    });
    const options = policy.actionAvailability(latePaid, now);
    assert.equal(
      options.find((item) => item.action === "REFUND")?.enabled,
      true,
    );
    for (const action of [
      "APPROVE_PAYMENT",
      "PREPARE",
      "READY",
      "SHIP",
      "DELIVER",
      "EXTEND",
      "CANCEL",
    ]) {
      assert.equal(
        options.find((item) => item.action === action)?.enabled,
        false,
        action,
      );
      assert.ok(options.find((item) => item.action === action)?.reason, action);
    }
  });

  it("ofrece cada acción en su estado válido y nunca inventa un retorno físico", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    const manual = order({
      saleId: null,
      paymentStatus: "UNDER_REVIEW",
      snapshot: {
        ...order().snapshot,
        payment: { ...order().snapshot.payment, code: "YAPE" },
      },
    });
    for (const action of [
      "APPROVE_PAYMENT",
      "REJECT_PROOF",
      "EXTEND",
      "CANCEL",
    ] as const)
      assert.equal(
        policy.allowedActions(manual, now).includes(action),
        true,
        action,
      );
    assert.equal(
      policy
        .allowedActions(order({ fulfillment: "PREPARING" }), now)
        .includes("READY"),
      true,
    );
    const delivery = order({
      fulfillment: "PREPARING",
      snapshot: {
        ...order().snapshot,
        shipping: { ...order().snapshot.shipping, kind: "DELIVERY" },
      },
    });
    assert.equal(policy.allowedActions(delivery, now).includes("SHIP"), true);
    assert.equal(
      policy
        .allowedActions(order({ fulfillment: "SHIPPED" }), now)
        .includes("DELIVER"),
      true,
    );
    assert.equal(
      policy
        .allowedActions(
          order({
            status: "CANCELLED",
            paymentStatus: "REFUNDED",
            saleId: null,
            refund: { status: "SUCCEEDED", restockedAt: null },
            reservations: [],
          }),
          now,
        )
        .includes("RESTOCK"),
      false,
    );
  });
  it("una devolución pendiente conserva el reintento pero no habilita preparar o entregar", () => {
    const options = policy.actionAvailability(
      order({ refund: { status: "PENDING", restockedAt: null } }),
      new Date("2026-11-08T12:00:00Z"),
    );
    assert.equal(
      options.find((item) => item.action === "REFUND")?.enabled,
      true,
    );
    assert.equal(
      options.find((item) => item.action === "PREPARE")?.enabled,
      false,
    );
  });
});
