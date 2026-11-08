import assert from "node:assert/strict";
import { test } from "node:test";
import { validateStoreAdminForm, validateStoreForm } from "./store-validation";

test("registro normaliza correo y nombres, conserva la contraseña y no envía confirmación ni campos ajenos", () => {
  const result = validateStoreForm("auth/register", {
    firstName: "  María  ",
    lastName: "O'Connor",
    email: " PERSONA@EXAMPLE.COM ",
    password: " Clave con espacios ",
    passwordConfirmation: " Clave con espacios ",
    acceptTerms: true,
    companyId: "otra-empresa",
  });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.data, {
    firstName: "María",
    lastName: "O'Connor",
    email: "persona@example.com",
    password: " Clave con espacios ",
    acceptTerms: true,
  });
});

test("registro indica confirmación y términos inválidos sin enviar datos", () => {
  const result = validateStoreForm("auth/register", {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.com",
    password: "clave1234",
    passwordConfirmation: "otra1234",
    acceptTerms: true,
  });
  assert.ok(result.errors.passwordConfirmation);
  assert.deepEqual(result.data, {});
});

test("perfil rechaza marcado, DNI y teléfono inválidos", () => {
  const result = validateStoreForm("me", {
    firstName: "<script>alert(1)</script>",
    lastName: "Pérez",
    documentValue: "1' OR 1=1",
    phone: "javascript:1",
  });
  assert.ok(result.errors.firstName);
  assert.ok(result.errors.documentValue);
  assert.ok(result.errors.phone);
});

test("direcciones distinguen texto legítimo de ubigeos inválidos y datos de control", () => {
  const valid = {
    label: "Casa",
    recipient: "Ana O'Connor",
    street: "Av. Los Álamos 120",
    phone: "999111222",
    district: "150101",
    reference: "Frente al parque",
    isDefault: false,
  };
  assert.deepEqual(validateStoreForm("me/addresses", valid).errors, {});
  assert.ok(
    validateStoreForm("me/addresses", {
      ...valid,
      district: "150101 UNION SELECT",
    }).errors.district,
  );
  assert.ok(
    validateStoreForm("me/addresses", { ...valid, street: "Calle\u0000oculta" })
      .errors.street,
  );
});

test("entrega administrativa exige cobertura o dirección y acota tarifas", () => {
  const base = {
    label: "Entrega local",
    kind: "DELIVERY",
    fee: 5,
    districts: ["150101"],
    enabled: true,
  };
  assert.deepEqual(validateStoreAdminForm("shipping-methods", base).errors, {});
  assert.ok(
    validateStoreAdminForm("shipping-methods", { ...base, districts: [] })
      .errors.districts,
  );
  assert.ok(
    validateStoreAdminForm("shipping-methods", {
      ...base,
      fee: Number.POSITIVE_INFINITY,
    }).errors.fee,
  );
  assert.ok(
    validateStoreAdminForm("shipping-methods", { ...base, kind: "PICKUP" })
      .errors.pickupAddress,
  );
});
