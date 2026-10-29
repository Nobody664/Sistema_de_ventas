import assert from "node:assert/strict";
import test from "node:test";
import {
  companyDateLabel,
  companyDayKey,
  validCompanyZone,
} from "./company-format";

test("el mismo instante se presenta en el día correspondiente a la zona del negocio", () => {
  const instant = "2026-10-26T05:30:00Z";
  assert.equal(companyDayKey(instant, "America/Lima"), "2026-10-26");
  assert.equal(companyDayKey(instant, "America/Mexico_City"), "2026-10-25");
  assert.equal(
    companyDateLabel(instant, "America/Mexico_City", { month: "2-digit" }),
    "25/10/2026",
  );
});

test("no convierte fechas ausentes o inválidas en datos inventados", () => {
  assert.equal(companyDateLabel(null, "America/Lima"), "—");
  assert.equal(companyDateLabel("invalid", "America/Lima"), "—");
  assert.equal(validCompanyZone("Zona/Inexistente"), "America/Lima");
});

test("normaliza los espacios del período horario para mantener SSR e hidratación consistentes", () => {
  const value = companyDateLabel("2026-10-26T05:30:00Z", "America/Lima", {
    hour: "2-digit",
    minute: "2-digit",
  });
  assert.equal(/[\u00a0\u202f]/.test(value), false);
  assert.ok(value.includes("12:30"));
});
