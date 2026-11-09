import assert from "node:assert/strict";
import test from "node:test";
import { savedStoreDefinition } from "./store-appearance";

test("guardar una vista excluye búsquedas, identidad y cursores", () => {
  const params = new URLSearchParams(
    "q=ana@example.test&cursor=opaque&companyId=foreign&view=board&queue=review&status=CONFIRMED",
  );
  assert.deepEqual(savedStoreDefinition("ORDERS", params), {
    layout: "board",
    queue: "review",
    status: "CONFIRMED",
  });
  assert.deepEqual(savedStoreDefinition("CATALOG", params), {
    layout: "gallery",
  });
  assert.deepEqual(
    savedStoreDefinition(
      "CUSTOMERS",
      new URLSearchParams("q=Ana&status=ACTIVE&view=gallery"),
    ),
    { layout: "list", status: "ACTIVE" },
  );
});
