import assert from "node:assert/strict";
import test from "node:test";
import {
  commerceEntry,
  storeAdminKeys,
} from "../features/store-admin/api/contracts";
import { getRouteRequirement } from "./plan-capabilities";

test("el centro de tienda distingue gestión de atención restringida", () => {
  assert.equal(commerceEntry({ mode: "MANAGE" }), "/comercio/resumen");
  assert.equal(
    commerceEntry({ mode: "CLOSEOUT" }),
    "/comercio/atencion/pedidos",
  );
  assert.deepEqual(getRouteRequirement("/comercio/catalogo"), {
    module: "storefront",
  });
  assert.deepEqual(getRouteRequirement("/comercio/atencion/pedidos"), {});
});

test("las consultas de tienda separan compañía, identidad y período", () => {
  const owner = storeAdminKeys("company-a", "owner-a");
  assert.notDeepEqual(
    owner.context,
    storeAdminKeys("company-b", "owner-a").context,
  );
  assert.notDeepEqual(
    owner.context,
    storeAdminKeys("company-a", "owner-b").context,
  );
  assert.notDeepEqual(owner.dashboard(7), owner.dashboard(30));
  assert.deepEqual(owner.dashboard(7).slice(0, 3), owner.all);
});
