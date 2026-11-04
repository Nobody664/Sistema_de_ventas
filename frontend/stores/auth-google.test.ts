import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useAuthStore } from "./auth.store";

const user = {
  id: "google-user",
  email: "persona@gmail.com",
  fullName: "Persona",
  avatarUrl: "https://lh3.googleusercontent.com/avatar",
  roles: ["COMPANY_ADMIN"],
  companyId: "company",
  companyStatus: "ACTIVE",
  planCode: "FREE",
  subscriptionStatus: "TRIALING",
  trialEndsAt: null,
};

afterEach(() =>
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  }),
);

test("loginWithGoogle autentica con el credential verificado", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(String(url));
    if (url === "/api/health/ready")
      return Response.json({
        status: "ok",
        service: "backend",
        checks: { database: { status: "ok" } },
      });
    if (url === "/api/auth/google") return Response.json({ user });
    throw new Error(`Unexpected URL ${url}`);
  });

  await useAuthStore.getState().loginWithGoogle("google-credential");

  const state = useAuthStore.getState();
  assert.equal(state.user?.id, user.id);
  assert.equal(state.isAuthenticated, true);
  assert.equal(state.error, null);
  assert.ok(calls.includes("/api/auth/google"));
});

test("loginWithGoogle expone el error del backend", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url === "/api/health/ready")
      return Response.json({
        status: "ok",
        service: "backend",
        checks: { database: { status: "ok" } },
      });
    if (url === "/api/auth/google")
      return Response.json(
        { message: "No existe una cuenta activa" },
        { status: 401 },
      );
    throw new Error(`Unexpected URL ${url}`);
  });

  await assert.rejects(
    () => useAuthStore.getState().loginWithGoogle("google-credential"),
    /No existe una cuenta activa/,
  );
  assert.equal(useAuthStore.getState().isAuthenticated, false);
  assert.equal(
    useAuthStore.getState().error,
    "No existe una cuenta activa",
  );
});
