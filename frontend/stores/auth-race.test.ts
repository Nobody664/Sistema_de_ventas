import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useAuthStore } from "./auth.store";

const user = {
  id: "owner",
  email: "owner@example.test",
  fullName: "Owner",
  roles: ["COMPANY_ADMIN"],
  companyId: "company",
};
afterEach(() =>
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  }),
);

test("un checkAuth antiguo con 401 no borra una sesión que acaba de iniciar", async (t) => {
  let finishCheck: (response: Response) => void = () => undefined;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url === "/api/auth/me")
      return new Promise<Response>((resolve) => {
        finishCheck = resolve;
      });
    if (url === "/api/health/ready")
      return Response.json({
        status: "ok",
        service: "backend",
        checks: { database: { status: "ok" } },
      });
    if (url === "/api/auth/login") return Response.json({ user });
    throw new Error(`Unexpected URL ${url}`);
  });
  const oldCheck = useAuthStore.getState().checkAuth();
  await useAuthStore.getState().login(user.email, "example-password");
  finishCheck(Response.json({ message: "Unauthorized" }, { status: 401 }));
  await oldCheck;
  const state = useAuthStore.getState();
  assert.equal(state.user?.id, user.id);
  assert.equal(state.isAuthenticated, true);
  assert.equal(state.isLoading, false);
  assert.equal(state.error, null);
});

test("una comprobación de sesión anterior al logout no vuelve a autenticar al usuario", async (t) => {
  let finishCheck: (response: Response) => void = () => undefined;
  t.mock.method(globalThis, "fetch", async (url: string) =>
    url === "/api/auth/me"
      ? new Promise<Response>((resolve) => {
          finishCheck = resolve;
        })
      : new Response(null, { status: 200 }),
  );
  const check = useAuthStore.getState().checkAuth();
  assert.equal(await useAuthStore.getState().logout(), true);
  finishCheck(Response.json(user));
  await check;
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().isAuthenticated, false);
});
