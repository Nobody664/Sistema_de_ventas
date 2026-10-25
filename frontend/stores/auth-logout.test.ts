import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { AuthUser } from "@/lib/api/auth";
import { useAuthStore } from "./auth.store";

const originalFetch = globalThis.fetch;

const testUser: AuthUser = {
  id: "user-1",
  email: "cajero@empresa.test",
  fullName: "Cajero de prueba",
  roles: ["CASHIER"],
  companyId: "company-1",
  companyStatus: "ACTIVE",
  planCode: "BASIC",
  subscriptionStatus: "ACTIVE",
  trialEndsAt: null,
};

function setAuthenticatedUser(): void {
  useAuthStore.setState({
    user: testUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });
});

test("logout conserva la sesión si el servidor responde con error", async () => {
  setAuthenticatedUser();
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ message: "No se pudo revocar" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const success = await useAuthStore.getState().logout();
  const state = useAuthStore.getState();

  assert.equal(success, false);
  assert.equal(calls, 1);
  assert.equal(state.user, testUser);
  assert.equal(state.isAuthenticated, true);
  assert.equal(state.isLoading, false);
  assert.equal(state.error, "No se pudo revocar");
});

test("logout conserva la sesión si falla la red", async () => {
  setAuthenticatedUser();

  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;

  const success = await useAuthStore.getState().logout();
  const state = useAuthStore.getState();

  assert.equal(success, false);
  assert.equal(state.user, testUser);
  assert.equal(state.isAuthenticated, true);
  assert.equal(state.isLoading, false);
  assert.equal(state.error, "Failed to fetch");
});

test("logout limpia la sesión cuando el servidor confirma el cierre", async () => {
  setAuthenticatedUser();

  globalThis.fetch = (async () =>
    new Response(null, { status: 200 })) as typeof fetch;

  const success = await useAuthStore.getState().logout();
  const state = useAuthStore.getState();

  assert.equal(success, true);
  assert.equal(state.user, null);
  assert.equal(state.isAuthenticated, false);
  assert.equal(state.isLoading, false);
  assert.equal(state.error, null);
});
