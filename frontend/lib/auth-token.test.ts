import assert from "node:assert/strict";
import test from "node:test";
import { isJwtExpired, readJwtClaim, readJwtPayload } from "./auth-token";

function tokenWithPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.firma`;
}

test("lee claims con base64url", () => {
  const token = tokenWithPayload({ sub: "abc", roles: ["CASHIER"] });
  assert.equal(readJwtClaim(token, "sub"), "abc");
  assert.deepEqual(readJwtClaim(token, "roles"), ["CASHIER"]);
});

test("considera expirado un token vencido o dentro del margen", () => {
  const now = Date.UTC(2026, 9, 25, 12, 0, 0);
  const expired = tokenWithPayload({ exp: now / 1000 - 1 });
  const almostExpired = tokenWithPayload({ exp: now / 1000 + 10 });
  const valid = tokenWithPayload({ exp: now / 1000 + 120 });

  assert.equal(isJwtExpired(expired, now), true);
  assert.equal(isJwtExpired(almostExpired, now), true);
  assert.equal(isJwtExpired(valid, now), false);
});

test("trata tokens inválidos como expirados", () => {
  assert.equal(isJwtExpired(undefined), true);
  assert.equal(isJwtExpired("no-es-un-jwt"), true);
  assert.equal(isJwtExpired("a.%%%.c"), true);
  assert.equal(readJwtPayload("a.%%%.c"), null);
});
