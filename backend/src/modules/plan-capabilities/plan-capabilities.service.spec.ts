import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { PlanCapabilitiesService } from "./plan-capabilities.service";
import {
  CORE_FEATURES,
  CORE_MODULES,
  FALLBACK_PLAN_CODE,
} from "./plan-capabilities.constants";

interface CacheStub {
  store: Map<string, unknown>;
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
}

function makeCache(seed?: Record<string, unknown>): CacheStub {
  const store = new Map<string, unknown>(Object.entries(seed ?? {}));
  return {
    store,
    get: async <T>(key: string) => (store.get(key) as T) ?? null,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
    del: async (key: string) => {
      store.delete(key);
    },
  };
}

const planRow = {
  id: "plan-1",
  code: "pro",
  name: "Pro",
  maxUsers: 10,
  maxProducts: 1000,
  modules: ["sales", "products"],
  permissions: ["reports:read"],
  apiEnabled: true,
  apiSearchDniEnabled: true,
  apiQuota: 500,
};

describe("PlanCapabilitiesService", () => {
  it("returns and caches capabilities from the active subscription plan", async () => {
    const cache = makeCache();
    const prisma = {
      subscription: {
        findFirst: async () => ({ status: "ACTIVE", plan: planRow }),
      },
      plan: { findUnique: async () => null },
    } as any;
    const svc = new PlanCapabilitiesService(prisma, cache as any);

    const caps = await svc.getCapabilities("company-1");

    assert.equal(caps.planCode, "pro");
    assert.deepEqual(caps.modules, ["sales", "products"]);
    assert.deepEqual(caps.features, ["reports:read"]);
    assert.equal(caps.apiQuota, 500);
    assert.ok(cache.store.has("plan:caps:company-1"));
  });

  it("uses the cached value on the second call without querying Prisma", async () => {
    let findFirstCalls = 0;
    const cache = makeCache();
    const prisma = {
      subscription: {
        findFirst: async () => {
          findFirstCalls += 1;
          return { status: "ACTIVE", plan: planRow };
        },
      },
      plan: { findUnique: async () => null },
    } as any;
    const svc = new PlanCapabilitiesService(prisma, cache as any);

    await svc.getCapabilities("company-1");
    await svc.getCapabilities("company-1");

    assert.equal(findFirstCalls, 1);
  });

  it("falls back to the FALLBACK_PLAN_CODE plan when there is no active subscription", async () => {
    const cache = makeCache();
    const fallback = { ...planRow, code: FALLBACK_PLAN_CODE, name: "Free" };
    const prisma = {
      subscription: { findFirst: async () => null },
      plan: { findUnique: async () => fallback },
    } as any;
    const svc = new PlanCapabilitiesService(prisma, cache as any);

    const caps = await svc.getCapabilities("company-2");

    assert.equal(caps.planCode, FALLBACK_PLAN_CODE);
  });

  it("ignores non-active subscriptions (e.g. EXPIRED) and uses the fallback plan", async () => {
    const cache = makeCache();
    let usedFallback = false;
    const prisma = {
      subscription: {
        findFirst: async () => ({ status: "EXPIRED", plan: planRow }),
      },
      plan: {
        findUnique: async () => {
          usedFallback = true;
          return { ...planRow, code: FALLBACK_PLAN_CODE };
        },
      },
    } as any;
    const svc = new PlanCapabilitiesService(prisma, cache as any);

    const caps = await svc.getCapabilities("company-3");

    assert.equal(usedFallback, true);
    assert.equal(caps.planCode, FALLBACK_PLAN_CODE);
  });

  it("returns hardcoded fallback capabilities when Prisma throws", async () => {
    const cache = makeCache();
    const prisma = {
      subscription: {
        findFirst: async () => {
          throw new Error("db down");
        },
      },
      plan: { findUnique: async () => null },
    } as any;
    const svc = new PlanCapabilitiesService(prisma, cache as any);

    const caps = await svc.getCapabilities("company-4");

    assert.equal(caps.planId, null);
    assert.equal(caps.planCode, FALLBACK_PLAN_CODE);
    assert.deepEqual(caps.modules, [...CORE_MODULES]);
    assert.deepEqual(caps.features, [...CORE_FEATURES]);
  });

  it("hasModule treats core modules as always present", async () => {
    const cache = makeCache();
    const prisma = {
      subscription: { findFirst: async () => null },
      plan: { findUnique: async () => null },
    } as any;
    const svc = new PlanCapabilitiesService(prisma, cache as any);

    const caps = await svc.getCapabilities("company-5");

    assert.equal(svc.hasModule(caps, CORE_MODULES[0]), true);
    assert.equal(svc.hasModule(caps, "sales"), false);
    assert.equal(svc.hasFeature(caps, "reports:read"), false);
  });

  it("invalidates the cache entry for a company", async () => {
    const cache = makeCache({ "plan:caps:company-6": { planCode: "pro" } });
    const prisma = { subscription: {}, plan: {} } as any;
    const svc = new PlanCapabilitiesService(prisma, cache as any);

    await svc.invalidate("company-6");

    assert.equal(cache.store.has("plan:caps:company-6"), false);
  });
});
