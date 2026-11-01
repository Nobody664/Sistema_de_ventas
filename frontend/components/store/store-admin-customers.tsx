"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export function StoreAdminCustomers() {
  const [accounts, setAccounts] = useState<
    {
      id: string;
      status: string;
      customer: {
        firstName: string;
        lastName: string | null;
        email: string | null;
      };
    }[]
  >([]);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      setAccounts(
        await apiFetch<typeof accounts>(`/store-admin/customers?page=${page}`),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar");
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="font-display text-xl font-bold">
        Cuentas de clientes finales
      </h2>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      <div className="mt-4 divide-y">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <strong>
                {account.customer.firstName} {account.customer.lastName}
              </strong>
              <p className="text-sm text-stone-500">
                {account.customer.email} ·{" "}
                {
                  {
                    ACTIVE: "Activa",
                    SUSPENDED: "Suspendida",
                    PENDING_VERIFICATION: "Pendiente de verificación",
                    CLOSED: "Cerrada",
                  }[account.status]
                }
              </p>
            </div>
            {["ACTIVE", "SUSPENDED"].includes(account.status) && (
              <button
                className="text-sm font-semibold text-teal-900"
                onClick={() =>
                  void apiFetch(`/store-admin/customers/${account.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      suspended: account.status === "ACTIVE",
                    }),
                  })
                    .then(load)
                    .catch((error: Error) => setMessage(error.message))
                }
              >
                {account.status === "ACTIVE"
                  ? "Suspender en esta empresa"
                  : "Reactivar cuenta"}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>{page}</span>
        <button
          disabled={accounts.length < 24}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
