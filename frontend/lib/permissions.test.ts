import assert from "node:assert/strict";
import test from "node:test";
import { hasEffectivePermission } from "@/types/permissions";

test("un cajero puede crear ventas y clientes, pero no exportar ni editar clientes", () => {
  assert.equal(hasEffectivePermission(["CASHIER"], "sale:create"), true);
  assert.equal(hasEffectivePermission(["CASHIER"], "customer:create"), true);
  assert.equal(hasEffectivePermission(["CASHIER"], "sale:export"), false);
  assert.equal(hasEffectivePermission(["CASHIER"], "customer:update"), false);
});

test("la revisión de upgrades es de plataforma y no de soporte", () => {
  assert.equal(
    hasEffectivePermission(["SUPPORT_ADMIN"], "platform:companies_manage"),
    false,
  );
  assert.equal(
    hasEffectivePermission(["SUPER_ADMIN"], "platform:companies_manage"),
    true,
  );
});

test("evalúa todos los roles sin depender de su orden y rechaza roles desconocidos", () => {
  assert.equal(
    hasEffectivePermission(["CASHIER", "MANAGER"], "sale:export"),
    true,
  );
  assert.equal(
    hasEffectivePermission(["MANAGER", "CASHIER"], "sale:export"),
    true,
  );
  assert.equal(hasEffectivePermission(["VIEWER"], "sale:list"), false);
  assert.equal(hasEffectivePermission(["unknown"], "sale:create"), false);
});
