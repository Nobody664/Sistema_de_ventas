"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminQuery, useAdminWrite } from "../api/queries";
import { SavedStoreViews } from "./studio-collaboration";
import {
  commerceButton,
  commerceInput,
  Heading,
  Panel,
  QueryState,
  Status,
  DateLabel,
  Money,
} from "./commerce-ui";

interface Account {
  id: string;
  status: string;
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone?: string | null;
  };
}
interface AccountPage {
  data: Account[];
  total: number;
  page: number;
  limit: number;
}
interface AccountDetail extends Account {
  verifiedAt: string | null;
  _count: { orders: number };
  orders: Array<{
    id: string;
    number: string;
    status: string;
    paymentStatus: string;
    totalAmount: string;
    createdAt: string;
  }>;
}

export function CustomerDetail({ id }: { id: string }) {
  const query = useAdminQuery<AccountDetail>(
    `accounts/${encodeURIComponent(id)}`,
  );
  const write = useAdminWrite<{ updated: boolean }>();
  const account = query.data;
  return (
    <div className="space-y-6">
      <Link
        className="text-sm font-semibold text-primary"
        href="/comercio/clientes"
      >
        ← Volver a clientes
      </Link>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {account && (
        <>
          <Heading
            title={`${account.customer.firstName} ${account.customer.lastName ?? ""}`}
            description="Cuenta comercial de esta tienda. La suspensión no modifica otras empresas ni las credenciales del usuario."
          />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-display text-xl font-semibold">
                Datos de contacto
              </h2>
              <dl className="mt-5 space-y-4 break-words text-sm">
                <div>
                  <dt className="text-foreground/50">Correo</dt>
                  <dd>{account.customer.email ?? "No indicado"}</dd>
                </div>
                <div>
                  <dt className="text-foreground/50">Teléfono</dt>
                  <dd>{account.customer.phone ?? "No indicado"}</dd>
                </div>
                <div>
                  <dt className="text-foreground/50">Registro</dt>
                  <dd>
                    <DateLabel value={account.createdAt} />
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground/50">Estado</dt>
                  <dd className="mt-2">
                    <Status value={account.status} />
                  </dd>
                </div>
              </dl>
              {["ACTIVE", "SUSPENDED"].includes(account.status) && (
                <button
                  className={`${commerceButton} mt-6`}
                  disabled={write.isPending}
                  onClick={() =>
                    void write
                      .mutateAsync({
                        resource: `customers/${account.id}`,
                        body: { suspended: account.status === "ACTIVE" },
                      })
                      .catch(() => undefined)
                  }
                >
                  {write.isPending
                    ? "Actualizando…"
                    : account.status === "ACTIVE"
                      ? "Suspender cuenta comercial"
                      : "Reactivar cuenta comercial"}
                </button>
              )}
              {write.error && (
                <p role="alert" className="mt-4 text-sm">
                  {write.error.message}
                </p>
              )}
              <p className="mt-4 text-xs leading-relaxed text-foreground/50">
                La suspensión revoca las sesiones comerciales de esta empresa.
                Los pedidos y el historial se conservan.
              </p>
            </Panel>
            <Panel>
              <h2 className="font-display text-xl font-semibold">
                Pedidos recientes · {account._count.orders} en total
              </h2>
              <ul className="mt-5 divide-y divide-foreground/10">
                {account.orders.map((order) => (
                  <li key={order.id} className="py-4">
                    <Link
                      href={`/comercio/pedidos/${order.id}`}
                      className="flex flex-wrap justify-between gap-3 text-sm font-semibold text-primary"
                    >
                      <span>{order.number}</span>
                      <Money value={order.totalAmount} />
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Status value={order.status} />
                      <Status value={order.paymentStatus} />
                    </div>
                  </li>
                ))}
              </ul>
              {account.orders.length === 0 && (
                <p className="mt-4 text-sm text-foreground/50">
                  Esta cuenta aún no tiene pedidos.
                </p>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

export function CustomersWorkspace() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = new URLSearchParams({ limit: "24" });
  for (const key of ["page", "q", "status"]) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  const query = useAdminQuery<AccountPage>(`accounts?${params}`);
  const navigate = (page: number) => {
    const next = new URLSearchParams(search.toString());
    next.set("page", String(page));
    router.replace(`${pathname}?${next}`);
  };
  return (
    <div className="space-y-6">
      <SavedStoreViews resource="CUSTOMERS" />
      <Heading
        title="Clientes de la tienda"
        description="Consulta las cuentas comerciales y su historial dentro de esta empresa."
      />
      <Panel>
        <form
          key={search.toString()}
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams();
            for (const [key, value] of new FormData(event.currentTarget))
              if (String(value).trim()) next.set(key, String(value).trim());
            router.replace(`${pathname}?${next}`);
          }}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <label className="text-xs font-semibold">
            Buscar cliente
            <input
              name="q"
              maxLength={80}
              defaultValue={search.get("q") ?? ""}
              placeholder="Nombre o correo"
              className={`${commerceInput} mt-2`}
            />
          </label>
          <label className="text-xs font-semibold">
            Estado de la cuenta
            <select
              name="status"
              aria-label="Estado de la cuenta"
              defaultValue={search.get("status") ?? ""}
              className={`${commerceInput} mt-2`}
            >
              <option value="">Todas las cuentas</option>
              <option value="ACTIVE">Activa</option>
              <option value="SUSPENDED">Suspendida</option>
              <option value="PENDING_VERIFICATION">
                Pendiente de verificación
              </option>
              <option value="CLOSED">Cerrada</option>
            </select>
          </label>
          <button className={`${commerceButton} self-end`}>
            Buscar clientes
          </button>
        </form>
      </Panel>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {query.data?.data.map((account) => (
          <Link
            href={`/comercio/clientes/${account.id}`}
            key={account.id}
            className="min-w-0 rounded-2xl border border-foreground/10 bg-card p-5 hover:border-primary/50"
          >
            <h2 className="break-words font-display text-xl font-semibold">
              {account.customer.firstName} {account.customer.lastName}
            </h2>
            <p className="my-3 break-all text-sm text-foreground/55">
              {account.customer.email ?? "Sin correo indicado"}
            </p>
            <Status value={account.status} />
          </Link>
        ))}
      </div>
      {query.data?.data.length === 0 && (
        <Panel>
          <p className="text-sm">No hay cuentas con estos filtros.</p>
        </Panel>
      )}
      {query.data && (
        <div className="flex items-center justify-between gap-3">
          <button
            className={commerceButton}
            disabled={query.data.page <= 1}
            onClick={() => navigate(query.data!.page - 1)}
          >
            Anterior
          </button>
          <span className="text-xs">
            Página {query.data.page} · {query.data.total} cuentas
          </span>
          <button
            className={commerceButton}
            disabled={query.data.page * query.data.limit >= query.data.total}
            onClick={() => navigate(query.data!.page + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
