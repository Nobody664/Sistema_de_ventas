import assert from "node:assert/strict";
import test from "node:test";
import {
  orderCommandBody,
  orderListResource,
  orderQueueResource,
  shouldReconcileCommerce,
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
  assert.deepEqual(orderCommandBody("CANCEL", 9, "").body, {
    action: "CANCEL",
    version: 9,
  });
  assert.ok(orderCommandBody("SHIP", 1, " ").error);
  assert.ok(orderCommandBody("APPROVE_PAYMENT", 1, "abc").error);
  assert.ok(orderCommandBody("REFUND", 1, "<script>").error);
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
