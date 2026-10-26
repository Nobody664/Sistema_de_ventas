import assert from "node:assert/strict";
import test from "node:test";
import {
  getHomeRoute,
  getSignInDestination,
  isPlatformUser,
} from "./role-navigation";

test("los administradores de plataforma no necesitan una empresa para tener un destino válido", () => {
  for (const role of ["SUPER_ADMIN", "SUPPORT_ADMIN"]) {
    assert.equal(getHomeRoute([role]), "/platform");
    assert.equal(getSignInDestination(null, [role]), "/platform");
    assert.equal(
      getSignInDestination("/dashboard?from=login", [role]),
      "/platform",
    );
  }
});

test("el administrador de negocio conserva Mi plan y no se dirige a la plataforma", () => {
  const roles = ["USER", "COMPANY_ADMIN"];
  assert.equal(isPlatformUser(roles), false);
  assert.equal(getHomeRoute(roles), "/dashboard");
  assert.equal(getSignInDestination("/subscription", roles), "/subscription");
  assert.equal(
    getSignInDestination("/platform/companies", roles),
    "/dashboard",
  );
});

test("la selección de destino conserva la validación de redirecciones y los roles mixtos", () => {
  assert.equal(
    getSignInDestination("/\\example.test", ["SUPER_ADMIN"]),
    "/platform",
  );
  assert.equal(
    getSignInDestination("/platform/plans", ["SUPER_ADMIN"]),
    "/platform/plans",
  );
  assert.equal(getSignInDestination("/profile", ["SUPER_ADMIN"]), "/profile");
  assert.equal(getHomeRoute(["COMPANY_ADMIN", "SUPER_ADMIN"]), "/platform");
  assert.equal(getHomeRoute(["CASHIER"]), "/dashboard");
});
