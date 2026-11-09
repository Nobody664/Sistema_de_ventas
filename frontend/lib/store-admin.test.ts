import assert from "node:assert/strict";
import test from "node:test";
import {
  commerceAttentionRoute,
  legacyCommerceRoute,
  commerceEntry,
  storeAdminKeys,
} from "../features/store-admin/api/contracts";
import { getRouteRequirement } from "./plan-capabilities";

test("el centro de tienda distingue gestión de atención restringida", () => {
  assert.equal(commerceEntry({ mode: "MANAGE" }), "/comercio/resumen");
  assert.equal(
    commerceEntry({
      mode: "MANAGE",
      experience: {
        enabled: false,
        eligible: true,
        reason: "COMPANY_DISABLED",
      },
    }),
    "/tienda-administracion",
  );
  assert.equal(
    legacyCommerceRoute("/comercio/pedidos/order-a"),
    "/tienda-administracion?pedido=order-a",
  );
  assert.equal(
    legacyCommerceRoute("/comercio/atencion/pedidos/order-a"),
    "/tienda-administracion?pedido=order-a",
  );
  assert.equal(
    legacyCommerceRoute("/comercio/catalogo"),
    "/tienda-administracion",
  );
  assert.equal(
    commerceEntry({ mode: "CLOSEOUT" }),
    "/comercio/atencion/pedidos",
  );
  assert.deepEqual(getRouteRequirement("/comercio/catalogo"), {
    module: "storefront",
  });
  assert.deepEqual(getRouteRequirement("/comercio/atencion/pedidos"), {});
  assert.equal(
    commerceAttentionRoute("/comercio/pedidos/order-b"),
    "/comercio/atencion/pedidos/order-b",
  );
  assert.equal(
    commerceAttentionRoute("/comercio/catalogo"),
    "/comercio/atencion/pedidos",
  );
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
