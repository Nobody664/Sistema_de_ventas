import assert from "node:assert/strict";
import test from "node:test";
import {
  SessionContractError,
  parseSessionUser,
  sessionScope,
} from "./session-contract";

const baseUser = {
  id: "user_1",
  email: "cajero@example.com",
  fullName: "Cajero Uno",
  roles: ["CASHIER"],
  companyId: "company_1",
  companyStatus: "ACTIVE",
  planCode: "PRO",
  subscriptionStatus: "ACTIVE",
  trialEndsAt: null,
};

test("acepta el contrato público con id", () => {
  const user = parseSessionUser(baseUser);
  assert.equal(user.id, "user_1");
  assert.equal(user.planCode, "PRO");
});

test("reconstruye id desde sub y normaliza opcionales", () => {
  const { id: _id, ...withoutId } = baseUser;
  const user = parseSessionUser({
    ...withoutId,
    sub: "user_2",
    companyId: null,
    companyStatus: null,
    planCode: null,
    subscriptionStatus: null,
    fullName: null,
  });

  assert.equal(user.id, "user_2");
  assert.equal(user.companyId, null);
  assert.equal(user.fullName, null);
});

test("rechaza una sesión sin id ni sub", () => {
  const { id: _id, ...withoutId } = baseUser;
  assert.throws(() => parseSessionUser(withoutId), SessionContractError);
});

test("rechaza correo inválido y roles que no son arreglo", () => {
  assert.throws(
    () => parseSessionUser({ ...baseUser, email: "sin-arroba" }),
    SessionContractError,
  );
  assert.throws(
    () => parseSessionUser({ ...baseUser, roles: "CASHIER" }),
    SessionContractError,
  );
});

test("el alcance separa empresa y usuario y no depende del orden de roles", () => {
  const first = parseSessionUser({
    ...baseUser,
    roles: ["CASHIER", "MANAGER"],
  });
  const reordered = parseSessionUser({
    ...baseUser,
    roles: ["MANAGER", "CASHIER"],
  });
  const otherUser = parseSessionUser({ ...baseUser, id: "user_2" });
  const otherCompany = parseSessionUser({
    ...baseUser,
    companyId: "company_2",
  });

  assert.equal(sessionScope(first), sessionScope(reordered));
  assert.notEqual(sessionScope(first), sessionScope(otherUser));
  assert.notEqual(sessionScope(first), sessionScope(otherCompany));
  assert.equal(sessionScope(null), "anonymous");
});
