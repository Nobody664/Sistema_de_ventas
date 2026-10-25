import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { scopedQueryKeyHash, setQueryScope } from "./query-scope";

test("la misma clave no reutiliza datos de otra sesión", async () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: scopedQueryKeyHash,
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });

  let calls = 0;
  const fetcher = (value: string) => async () => {
    calls += 1;
    return value;
  };

  setQueryScope("company_a:user_a:CASHIER");
  const first = await client.fetchQuery({
    queryKey: ["products"],
    queryFn: fetcher("empresa A"),
  });

  setQueryScope("company_b:user_b:CASHIER");
  const second = await client.fetchQuery({
    queryKey: ["products"],
    queryFn: fetcher("empresa B"),
  });

  setQueryScope("company_a:user_a:CASHIER");
  const third = await client.fetchQuery({
    queryKey: ["products"],
    queryFn: fetcher("no debería ejecutarse"),
  });

  assert.equal(first, "empresa A");
  assert.equal(second, "empresa B");
  assert.equal(third, "empresa A");
  assert.equal(calls, 2);
});

test("el hash cambia al cambiar el alcance", () => {
  setQueryScope("scope-a");
  const first = scopedQueryKeyHash(["products"]);
  setQueryScope("scope-b");
  const second = scopedQueryKeyHash(["products"]);

  assert.notEqual(first, second);
});
