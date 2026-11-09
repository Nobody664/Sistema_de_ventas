import assert from "node:assert/strict";
import test from "node:test";
import { storeExperiencePolicy } from "./store-adoption.policy";

test("la activación distingue despliegue, piloto y reversión por compañía", () => {
  assert.equal(storeExperiencePolicy("a", true).enabled, true);
  assert.equal(storeExperiencePolicy("a", false).enabled, false);
  assert.equal(
    storeExperiencePolicy("a", true, "pilot", " b, a ").enabled,
    true,
  );
  assert.equal(
    storeExperiencePolicy("a", true, "pilot", "ab,b").eligible,
    false,
  );
  assert.equal(storeExperiencePolicy("a", true, "off", "a").enabled, false);
  assert.equal(
    storeExperiencePolicy("a", true, "invalid", "a").eligible,
    false,
  );
});
