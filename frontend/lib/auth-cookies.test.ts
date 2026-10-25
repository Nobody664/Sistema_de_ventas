import assert from "node:assert/strict";
import test from "node:test";
import { getSetCookieHeaders, readSetCookieValue } from "./auth-cookies";

test("extrae cookies por nombre sin confundir prefijos", () => {
  const headers = [
    "access_token=abc.def.ghi; Path=/; HttpOnly; SameSite=Lax",
    "refresh_token=refresh%2Ftoken; Path=/; HttpOnly",
  ];

  assert.equal(readSetCookieValue(headers, "access_token"), "abc.def.ghi");
  assert.equal(readSetCookieValue(headers, "refresh_token"), "refresh/token");
  assert.equal(readSetCookieValue(headers, "token"), undefined);
});

test("tolera cabeceras inválidas", () => {
  assert.equal(readSetCookieValue(["sin-signo"], "access_token"), undefined);
  assert.equal(readSetCookieValue([], "access_token"), undefined);
});

test("lee múltiples Set-Cookie cuando la plataforma lo soporta", () => {
  const headers = new Headers();
  headers.append("set-cookie", "access_token=a; Path=/");
  headers.append("set-cookie", "refresh_token=r; Path=/");

  const values = getSetCookieHeaders(headers);
  assert.equal(readSetCookieValue(values, "access_token"), "a");
  assert.equal(readSetCookieValue(values, "refresh_token"), "r");
});
