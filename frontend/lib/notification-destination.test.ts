import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationDestination } from "./notification-destination";

test("stock and expiry notifications open their product, including historical list-only actions", () => {
  for (const type of ["LOW_STOCK", "PRODUCT_EXPIRING_SOON"] as const) {
    for (const actionUrl of [null, "/products", "/inventory"]) {
      assert.equal(
        notificationDestination({
          type,
          scope: "COMPANY",
          data: { productId: "product-a" },
          actionUrl,
        }),
        "/products/product-a",
      );
    }
  }
});

test("invalid identifiers and external or encoded-escape destinations cannot become navigation targets", () => {
  for (const productId of [
    "../foreign",
    "//evil.test",
    "a/b",
    "%2f%2fevil.test",
    "",
  ]) {
    for (const actionUrl of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/%2f%2fevil.test",
    ]) {
      assert.equal(
        notificationDestination({
          type: "LOW_STOCK",
          scope: "COMPANY",
          data: { productId },
          actionUrl,
        }),
        "/products",
      );
    }
  }
});

test("other notification actions and platform notices retain their own destination", () => {
  assert.equal(
    notificationDestination({
      type: "NEW_SALE",
      scope: "COMPANY",
      data: {},
      actionUrl: "/sales/sale-a",
    }),
    "/sales/sale-a",
  );
  assert.equal(
    notificationDestination(
      {
        type: "LOW_STOCK",
        scope: "PLATFORM",
        data: { productId: "product-a" },
        actionUrl: "/platform/companies",
      },
      true,
    ),
    "/platform/companies",
  );
});
