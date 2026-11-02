import assert from "node:assert/strict";
import { test } from "node:test";
import { dniIdentityFields } from "./document-identity";

test("mapea los nombres y ambos apellidos sin utilizar el apellido como nombre", () => {
  assert.deepEqual(
    dniIdentityFields(
      {
        dni: "00000001",
        nombres: "ANA",
        apellidoPaterno: "PÉREZ",
        apellidoMaterno: "LÓPEZ",
      },
      "00000001",
    ),
    {
      firstName: "ANA",
      lastName: "PÉREZ LÓPEZ",
      phone: undefined,
      address: undefined,
    },
  );
  assert.throws(() =>
    dniIdentityFields(
      { dni: "00000001", apellidoPaterno: "PÉREZ" },
      "00000001",
    ),
  );
  assert.throws(() =>
    dniIdentityFields({ dni: "99999999", nombres: "OTRA" }, "00000001"),
  );
});

test("admite nombre completo cuando el proveedor no entrega desglose", () => {
  const result = dniIdentityFields(
    { dni: "00000001", nombreCompleto: "ANA PÉREZ LÓPEZ" },
    "00000001",
  );
  assert.equal(result.firstName, "ANA PÉREZ LÓPEZ");
  assert.equal(result.lastName, "");
});
