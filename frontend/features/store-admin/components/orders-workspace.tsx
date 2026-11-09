"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminQuery } from "../api/queries";
import {
  type AdminOrderRow,
  type OrderPage,
  queues,
  orderListResource,
  orderQueueResource,
} from "../api/operations";
import {
  commerceButton,
  commerceInput,
  Panel,
  Heading,
  QueryState,
  Money,
  Status,
  DateLabel,
} from "./commerce-ui";

function OrderCard({ order, base }: { order: AdminOrderRow; base: string }) {
  return (
    <Link
      href={`${base}/${order.id}`}
      className="block min-w-0 space-y-3 rounded-xl border border-foreground/10 bg-background p-4 transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="break-all text-sm">{order.number}</strong>
        <Money value={order.totalAmount} />
      </div>
      <p className="truncate text-sm text-foreground/65">
        {order.customer.name || order.customer.email || "Cliente de tienda"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Status value={order.status} />
        <Status value={order.paymentStatus} />
        <Status value={order.fulfillment} />
      </div>
      {order.refundRequestedAt && (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          Devolución solicitada
        </p>
      )}
      <p className="text-xs text-foreground/45">
        <DateLabel value={order.createdAt} />
      </p>
    </Link>
  );
}

function QueueColumn({
  queue,
  base,
  filters,
}: {
  queue: (typeof queues)[number];
  base: string;
  filters: string;
}) {
  const query = useAdminQuery<OrderPage>(
    orderQueueResource(new URLSearchParams(filters), queue.key),
  );
  const listFilters = new URLSearchParams(filters);
  listFilters.set("queue", queue.key);
  listFilters.delete("cursor");
  listFilters.delete("view");
  return (
    <section className="min-w-0 rounded-2xl bg-foreground/[.035] p-3">
      <h2 className="mb-4 flex justify-between gap-2 px-1 font-display font-semibold">
        {queue.label}
        <span className="text-foreground/45">
          {query.data?.totals.matched ?? "—"}
        </span>
      </h2>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      <div className="space-y-3">
        {query.data?.data.map((order) => (
          <OrderCard key={order.id} order={order} base={base} />
        ))}
        {query.data?.data.length === 0 && (
          <p className="p-4 text-sm text-foreground/50">
            Sin pendientes en esta cola.
          </p>
        )}
        {query.data?.pageInfo.hasMore && (
          <Link
            href={`${base}?${listFilters}`}
            className={`${commerceButton} w-full`}
          >
            Ver toda la cola
          </Link>
        )}
      </div>
    </section>
  );
}

export function GatewayIncidents() {
  const query = useAdminQuery<
    Array<{
      id: string;
      providerPaymentId: string;
      receivedAt: string;
      detail: unknown;
    }>
  >("payment-events");
  return (
    <Panel>
      <h2 className="font-display text-xl font-semibold">
        Incidencias de pasarela
      </h2>
      <p className="my-3 text-sm text-foreground/55">
        Pagos adicionales, parciales o fuera de reserva. Verifica el cobro en la
        cuenta del comercio antes de decidir una devolución.
      </p>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data?.length === 0 && (
        <p className="text-sm text-foreground/50">
          No hay incidencias pendientes.
        </p>
      )}
      <ul className="divide-y divide-foreground/10">
        {query.data?.map((event) => (
          <li
            key={event.id}
            className="flex flex-wrap justify-between gap-2 py-3 text-sm"
          >
            <strong>Pago {event.providerPaymentId}</strong>
            <span>
              {event.detail &&
              typeof event.detail === "object" &&
              "status" in event.detail &&
              typeof event.detail.status === "string"
                ? event.detail.status
                : "Revisar en la pasarela"}
            </span>
            <DateLabel value={event.receivedAt} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function OrdersWorkspace({
  area = "pedidos",
  restricted = false,
}: {
  area?: "pedidos" | "pagos" | "entregas";
  restricted?: boolean;
}) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const base = restricted ? "/comercio/atencion/pedidos" : "/comercio/pedidos";
  const board = search.get("view") === "board";
  const resource = orderListResource(
    new URLSearchParams(search.toString()),
    area,
  );
  const query = useAdminQuery<OrderPage>(resource, !board);
  const setView = (view: string) => {
    const params = new URLSearchParams(search.toString());
    params.set("view", view);
    params.delete("cursor");
    router.replace(`${pathname}?${params}`);
  };
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, raw] of values) {
      const value = String(raw).trim();
      if (value) params.set(key, value);
    }
    if (board) params.set("view", "board");
    router.replace(`${pathname}?${params}`);
  };
  const pageLink = (cursor?: string | null) => {
    const params = new URLSearchParams(search.toString());
    if (cursor) params.set("cursor", cursor);
    else params.delete("cursor");
    return `${pathname}?${params}`;
  };
  return (
    <div className="space-y-6">
      <Heading
        title={
          restricted
            ? "Atención de pedidos existentes"
            : area === "pagos"
              ? "Pagos y conciliación"
              : area === "entregas"
                ? "Retiros y entregas"
                : "Pedidos"
        }
        description={
          area === "pagos"
            ? "Revisa comprobantes, pagos tardíos y devoluciones sin confundirlos con ventas completadas."
            : area === "entregas"
              ? "Coordina la preparación, el retiro y el despacho con estados reales de cada pedido."
              : "Encuentra tus pedidos, consulta su historia y ejecuta las acciones disponibles en su detalle."
        }
      />
      <Panel>
        <form
          onSubmit={applyFilters}
          key={search.toString()}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <label className="text-xs font-semibold">
            Buscar pedido o cliente
            <input
              name="q"
              defaultValue={search.get("q") ?? ""}
              maxLength={80}
              className={`${commerceInput} mt-2`}
              placeholder="Número, nombre o correo"
            />
          </label>
          <label className="text-xs font-semibold">
            Cola
            <select
              name="queue"
              aria-label="Cola"
              defaultValue={
                search.get("queue") ?? (area === "pagos" ? "review" : "all")
              }
              className={`${commerceInput} mt-2`}
            >
              <option value="all">Todas las colas</option>
              {queues.map((queue) => (
                <option key={queue.key} value={queue.key}>
                  {queue.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Pago
            <select
              name="paymentStatus"
              aria-label="Pago"
              defaultValue={search.get("paymentStatus") ?? ""}
              className={`${commerceInput} mt-2`}
            >
              <option value="">Todos los pagos</option>
              <option value="PENDING">Pendiente</option>
              <option value="UNDER_REVIEW">Comprobante en revisión</option>
              <option value="PAID">Pagado</option>
              <option value="REFUNDED">Devuelto</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Tipo de entrega
            <select
              name="shippingKind"
              aria-label="Tipo de entrega"
              defaultValue={search.get("shippingKind") ?? ""}
              className={`${commerceInput} mt-2`}
            >
              <option value="">Retiro y delivery</option>
              <option value="PICKUP">Retiro</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Estado del pedido
            <select
              name="status"
              aria-label="Estado del pedido"
              defaultValue={search.get("status") ?? ""}
              className={`${commerceInput} mt-2`}
            >
              <option value="">Todos los estados</option>
              {[
                "PENDING_PAYMENT",
                "CONFIRMED",
                "REVIEW_REQUIRED",
                "COMPLETED",
                "CANCELLED",
                "EXPIRED",
              ].map((value) => (
                <option key={value} value={value}>
                  {
                    {
                      PENDING_PAYMENT: "Pendiente de pago",
                      CONFIRMED: "Confirmado",
                      REVIEW_REQUIRED: "Requiere conciliación",
                      COMPLETED: "Completado",
                      CANCELLED: "Cancelado",
                      EXPIRED: "Vencido",
                    }[value]
                  }
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button className={commercePrimaryButton}>Aplicar filtros</button>
            <Link href={pathname} className={commerceButton}>
              Limpiar
            </Link>
          </div>
        </form>
      </Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/55">
          {board
            ? "Colas operativas · no modifican pagos ni inventario"
            : `${query.data?.totals.matched ?? "—"} pedidos encontrados`}
        </p>
        <div className="flex gap-2">
          <button
            aria-pressed={!board}
            className={commerceButton}
            onClick={() => setView("list")}
          >
            Lista
          </button>
          <button
            aria-pressed={board}
            className={commerceButton}
            onClick={() => setView("board")}
          >
            Tablero
          </button>
        </div>
      </div>
      {board ? (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {queues.map((queue) => (
            <QueueColumn
              key={queue.key}
              queue={queue}
              base={base}
              filters={search.toString()}
            />
          ))}
        </div>
      ) : (
        <>
          <QueryState
            pending={query.isPending}
            error={query.error}
            retry={() => void query.refetch()}
          />
          {query.data?.data.length === 0 && (
            <Panel>
              <p className="text-sm text-foreground/60">
                No hay pedidos con estos filtros.
              </p>
            </Panel>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {query.data?.data.map((order) => (
              <OrderCard key={order.id} order={order} base={base} />
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            {search.has("cursor") ? (
              <Link className={commerceButton} href={pageLink()}>
                Primera página
              </Link>
            ) : (
              <span />
            )}
            {query.data?.pageInfo.nextCursor && (
              <Link
                className={commerceButton}
                href={pageLink(query.data.pageInfo.nextCursor)}
              >
                Siguiente página
              </Link>
            )}
          </div>
        </>
      )}
      {area === "pagos" && <GatewayIncidents />}
    </div>
  );
}

const commercePrimaryButton = `${commerceButton} !border-primary !bg-primary !text-primary-foreground`;
