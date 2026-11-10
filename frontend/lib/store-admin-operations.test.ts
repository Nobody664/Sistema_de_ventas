import assert from "node:assert/strict";
import test from "node:test";
import {
  orderCommandBody,
  orderListResource,
  orderQueueResource,
  shouldReconcileCommerce,
  orderActionOptions,
  orderActionFeedback,
} from "../features/store-admin/api/operations";

test("los comandos conservan versión y exigen referencias según el hecho real", () => {
  assert.deepEqual(orderCommandBody("APPROVE_PAYMENT", 7, "  TX-1234  ").body, {
    action: "APPROVE_PAYMENT",
    version: 7,
    reference: "TX-1234",
  });
  assert.deepEqual(orderCommandBody("REFUND", 8, "DEV-12345").body, {
    version: 8,
    reference: "DEV-12345",
  });
  assert.deepEqual(
    orderCommandBody("CANCEL", 9, "", "Sin disponibilidad").body,
    {
      action: "CANCEL",
      version: 9,
      reason: "Sin disponibilidad",
    },
  );
  assert.ok(orderCommandBody("REJECT_PROOF", 1, "", "").error);
  assert.ok(orderCommandBody("CANCEL", 1, "", "<script>").error);
  assert.deepEqual(
    orderCommandBody(
      "REJECT_PROOF",
      4,
      "referencia anterior",
      "No coincide el importe",
    ).body,
    { action: "REJECT_PROOF", version: 4, reason: "No coincide el importe" },
  );
  assert.deepEqual(
    orderCommandBody("PREPARE", 5, "<referencia obsoleta>").body,
    { action: "PREPARE", version: 5 },
  );
  assert.ok(orderCommandBody("SHIP", 1, " ").error);
  assert.ok(orderCommandBody("APPROVE_PAYMENT", 1, "abc").error);
  assert.ok(orderCommandBody("REFUND", 1, "<script>").error);
});

test("la interfaz respeta las acciones del servidor y no presenta conciliaciones como pedidos aceptados", () => {
  const order = {
    paymentStatus: "PAID",
    status: "REVIEW_REQUIRED",
    saleId: undefined,
    allowedActions: [],
    actionAvailability: [
      { action: "PREPARE", enabled: false, reason: "Sin venta confirmada" },
      { action: "REFUND", enabled: true, reason: null },
    ],
  };
  assert.equal(
    orderActionOptions(order).find((option) => option.action === "PREPARE")
      ?.enabled,
    false,
  );
  assert.equal(
    orderActionOptions(order).find((option) => option.action === "REFUND")
      ?.enabled,
    true,
  );
  assert.ok(
    orderActionFeedback("APPROVE_PAYMENT", order).includes(
      "no se confirmó disponibilidad",
    ),
  );
  assert.ok(orderActionFeedback("REFUND", order).includes("aún no confirmó"));
  assert.ok(orderCommandBody("UNKNOWN", 1, "").error);
});

test("los filtros enviados al backend excluyen controles de vista y conservan el cursor", () => {
  const params = new URLSearchParams(
    "q=Ana&view=board&queue=all&shippingKind=DELIVERY&cursor=opaque&companyId=foreign",
  );
  const resource = orderListResource(params, "pagos");
  assert.equal(
    resource,
    "orders?limit=30&q=Ana&shippingKind=DELIVERY&cursor=opaque",
  );
  assert.equal(
    orderListResource(new URLSearchParams(), "pagos"),
    "orders?limit=30&queue=review",
  );
  const board = new URLSearchParams(
    orderQueueResource(
      new URLSearchParams(
        "view=board&cursor=old&paymentStatus=PAID&queue=review",
      ),
      "preparing",
    ).split("?")[1],
  );
  assert.equal(board.has("view"), false);
  assert.equal(board.has("cursor"), false);
  assert.equal(board.get("paymentStatus"), "PAID");
  assert.equal(board.get("queue"), "preparing");
  assert.equal(board.get("limit"), "10");
});

test("los avisos invalidan solo el comercio correcto y la reconexión reconcilia datos", () => {
  const empty = { isConnected: true, notifications: [] };
  const notice = {
    id: "notice-a",
    companyId: "a",
    actionUrl: "/comercio/pedidos/order-a",
  };
  const updated = { isConnected: true, notifications: [notice] };
  assert.equal(shouldReconcileCommerce(updated, empty, "a"), true);
  assert.equal(shouldReconcileCommerce(updated, empty, "b"), false);
  assert.equal(shouldReconcileCommerce(updated, updated, "a"), false);
  assert.equal(
    shouldReconcileCommerce(empty, { ...empty, isConnected: false }, "a"),
    true,
  );
  assert.equal(
    shouldReconcileCommerce(
      {
        ...updated,
        notifications: [{ ...notice, actionUrl: "/products/product-a" }],
      },
      empty,
      "a",
    ),
    false,
  );
});
