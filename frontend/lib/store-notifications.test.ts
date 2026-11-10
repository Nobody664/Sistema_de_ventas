import assert from "node:assert/strict";
import test from "node:test";
import {
  isBuyerNotificationFeed,
  latestBuyerOrderUpdates,
} from "./store-notifications";

const notice = {
  id: "notice-a",
  orderId: "order-a",
  version: 2,
  message: "Comprobante rechazado: importe incorrecto",
  createdAt: "2026-11-10T12:00:00Z",
  readAt: null,
  order: { number: "WEB-001" },
};
test("el feed exige identidad y avisos válidos antes de mostrarlos al comprador", () => {
  assert.equal(
    isBuyerNotificationFeed({
      accountId: "account-a",
      unreadCount: 1,
      data: [notice],
    }),
    true,
  );
  for (const value of [
    [],
    { unreadCount: 1, data: [notice] },
    { accountId: "a", unreadCount: -1, data: [] },
    { accountId: "a", unreadCount: 1, data: [{ ...notice, version: 0 }] },
    { accountId: "a", unreadCount: 51, data: Array(51).fill(notice) },
  ])
    assert.equal(isBuyerNotificationFeed(value), false);
});
test("las novedades se reconcilian una vez por pedido con su versión más reciente", () => {
  const result = latestBuyerOrderUpdates([
    notice,
    { ...notice, id: "notice-b", version: 4 },
    { ...notice, id: "notice-c", orderId: "order-b", version: 3 },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result.find((item) => item.orderId === "order-a")?.version, 4);
  assert.equal(result.find((item) => item.orderId === "order-b")?.version, 3);
});
