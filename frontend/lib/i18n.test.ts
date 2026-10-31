import assert from "node:assert/strict";
import { test } from "node:test";
import { localeFromValue, translate } from "./i18n";

test("settings translations use a closed locale list and keep user data unchanged", () => {
  assert.equal(localeFromValue("en"), "en");
  assert.equal(localeFromValue("fr"), "es");
  assert.equal(localeFromValue(undefined), "es");
  assert.equal(translate("es", "Configuración"), "Configuración");
  assert.equal(translate("en", "Configuración"), "Settings");
  assert.equal(translate("en", "Ventas registradas"), "Recorded sales");
  assert.equal(
    translate("en", "Canales de notificación"),
    "Notification channels",
  );
  for (const value of ["Nombre de mi negocio", "__proto__", "constructor"])
    assert.equal(translate("en", value), value);
});
