import assert from "node:assert/strict";
import test from "node:test";
import { contentSecurityPolicy } from "./content-security-policy";

test("la política de producción exige nonce en scripts y limita recursos y formularios", () => {
  const policy = contentSecurityPolicy("test-nonce");
  const script = policy
    .split("; ")
    .find((directive) => directive.startsWith("script-src"));
  assert.ok(script?.includes("'nonce-test-nonce'"));
  assert.ok(!script?.includes("unsafe-inline"));
  assert.ok(!script?.includes("unsafe-eval"));
  assert.ok(policy.includes("object-src 'none'"));
  assert.ok(policy.includes("frame-ancestors 'none'"));
  assert.ok(policy.includes("form-action 'self'"));
  assert.ok(contentSecurityPolicy("dev", true).includes("'unsafe-eval'"));
});
