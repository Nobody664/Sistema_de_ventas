"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api";
import { useAdminQuery, useAdminWrite } from "../api/queries";
import {
  type AdminOrderDetail,
  commandLabels,
  orderCommandBody,
} from "../api/operations";
import {
  commerceButton,
  commercePrimary,
  commerceInput,
  Heading,
  Panel,
  Money,
  Status,
  DateLabel,
  QueryState,
} from "./commerce-ui";

function PrivateProof({ id }: { id: string }) {
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch<{ image: string }>(
      `/store-admin/proofs/${encodeURIComponent(id)}`,
      { signal: controller.signal },
    )
      .then((result) => setImage(result.image))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar el comprobante",
          );
      });
    return () => controller.abort();
  }, [id]);
  return (
    <>
      {error ? (
        <p role="alert">{error}</p>
      ) : image ? (
        <Image
          src={image}
          alt="Comprobante privado del pedido"
          width={1200}
          height={1600}
          unoptimized
          className="max-h-[65vh] w-full object-contain"
        />
      ) : (
        <p role="status">Cargando comprobante…</p>
      )}
    </>
  );
}

export function OrderDetail({
  id,
  restricted = false,
}: {
  id: string;
  restricted?: boolean;
}) {
  const query = useAdminQuery<AdminOrderDetail>(
    `orders/${encodeURIComponent(id)}`,
  );
  const write = useAdminWrite<AdminOrderDetail>();
  const [action, setAction] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const order = query.data;
  const available = [
    ...(order?.allowedActions ?? []),
    ...(order?.paymentStatus === "PAID" ? ["REFUND"] : []),
  ];
  const perform = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order || write.isPending || !available.includes(action)) return;
    const command = orderCommandBody(action, order.version, reference);
    if (command.error) {
      setMessage(command.error);
      return;
    }
    setMessage("");
    try {
      await write.mutateAsync({
        resource: `orders/${encodeURIComponent(id)}${action === "REFUND" ? "/refund" : ""}`,
        method: action === "REFUND" ? "POST" : "PATCH",
        body: command.body,
      });
      setAction("");
      setReference("");
      setMessage(
        "La operación fue registrada. Revisa el estado actualizado del pedido.",
      );
    } catch (error) {
      await query.refetch();
      if (error instanceof ApiError && error.status === 409) {
        setAction("");
        setMessage(
          "El pedido cambió mientras lo revisabas. Recargamos el detalle; revisa los cambios antes de repetir la acción.",
        );
      } else
        setMessage(
          `${error instanceof Error ? error.message : "No se pudo completar la operación"}. Revisa el estado actualizado antes de reintentar.`,
        );
    }
  };
  return (
    <div className="space-y-6">
      <Link
        href={restricted ? "/comercio/atencion/pedidos" : "/comercio/pedidos"}
        className="text-sm font-semibold text-primary"
      >
        ← Volver a pedidos
      </Link>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {order && (
        <>
          <Heading
            title={order.number}
            description="El historial, los importes y las acciones de este pedido corresponden a su configuración original."
          />
          <div className="flex flex-wrap gap-2">
            <Status value={order.status} />
            <Status value={order.paymentStatus} />
            <Status value={order.fulfillment} />
          </div>
          {order.status === "REVIEW_REQUIRED" && (
            <p
              role="status"
              className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm"
            >
              Este pedido requiere conciliación. Un pago recibido fuera de
              reserva no significa que se haya creado una venta o asegurado la
              disponibilidad.
            </p>
          )}
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,.7fr)]">
            <div className="space-y-6">
              <Panel>
                <h2 className="font-display text-xl font-semibold">
                  Productos y total
                </h2>
                <ul className="my-5 divide-y divide-foreground/10">
                  {order.snapshot.lines.map((line, index) => (
                    <li
                      key={index}
                      className="flex justify-between gap-4 py-4 text-sm"
                    >
                      <span className="min-w-0 break-words">
                        {line.name} {line.presentationName} × {line.quantity}
                      </span>
                      <Money value={line.totalPrice} />
                    </li>
                  ))}
                </ul>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd>
                      <Money value={order.snapshot.subtotal} />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Envío</dt>
                    <dd>
                      <Money value={order.snapshot.shippingAmount} />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Impuestos</dt>
                    <dd>
                      <Money value={order.snapshot.taxAmount} />
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-foreground/10 pt-4 font-display text-xl font-semibold">
                    <dt>Total</dt>
                    <dd>
                      <Money value={order.totalAmount} />
                    </dd>
                  </div>
                </dl>
              </Panel>
              <Panel>
                <h2 className="font-display text-xl font-semibold">
                  Pago y comprobantes
                </h2>
                <p className="mt-4 font-semibold">
                  {order.snapshot.payment.label}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground/60">
                  {order.snapshot.payment.instructions}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {order.proofs.map((item, index) => (
                    <button
                      key={item.id}
                      className={commerceButton}
                      onClick={() => setProof(item.id)}
                    >
                      Ver comprobante {index + 1}
                    </button>
                  ))}
                </div>
                {order.proofs.length === 0 && (
                  <p className="mt-4 text-sm text-foreground/45">
                    Sin comprobantes adjuntos.
                  </p>
                )}
                {order.refundRequestedAt && (
                  <p className="mt-4 rounded-xl bg-amber-400/10 p-4 text-sm">
                    Solicitud de devolución:{" "}
                    {order.refundReason || "Sin motivo indicado"}
                  </p>
                )}
                {order.refund && (
                  <p className="mt-4 text-sm">
                    Devolución: <Status value={order.refund.status} /> ·{" "}
                    {order.refund.restockedAt
                      ? "Retorno físico registrado"
                      : "El retorno físico no ha sido registrado"}
                  </p>
                )}
              </Panel>
              <Panel>
                <h2 className="font-display text-xl font-semibold">
                  Historial
                </h2>
                <ol className="mt-5 space-y-4 border-l-2 border-primary/20 pl-5">
                  {order.history.map((entry) => (
                    <li key={entry.version}>
                      <p className="text-sm">{entry.message}</p>
                      <p className="mt-1 text-xs text-foreground/45">
                        <DateLabel value={entry.createdAt} />
                      </p>
                    </li>
                  ))}
                </ol>
              </Panel>
            </div>
            <div className="space-y-6">
              <Panel>
                <h2 className="font-display text-xl font-semibold">
                  Cliente y entrega
                </h2>
                <p className="mt-4 font-semibold">
                  {order.snapshot.buyer.firstName}{" "}
                  {order.snapshot.buyer.lastName}
                </p>
                <p className="mt-3 text-sm">{order.snapshot.shipping.label}</p>
                <p className="mt-2 break-words text-sm text-foreground/65">
                  {order.snapshot.address
                    ? `${order.snapshot.address.recipient} · ${order.snapshot.address.street} · Ubigeo ${order.snapshot.address.district} · ${order.snapshot.address.phone}`
                    : order.snapshot.shipping.pickupAddress}
                </p>
                {order.trackingCode && (
                  <p className="mt-3 break-all text-sm font-semibold">
                    Seguimiento: {order.trackingCode}
                  </p>
                )}
                <p className="mt-4 text-xs text-foreground/45">
                  Creado: <DateLabel value={order.createdAt} />
                </p>
              </Panel>
              <Panel>
                <h2 className="font-display text-xl font-semibold">
                  Acciones disponibles
                </h2>
                <p className="mt-3 text-xs leading-relaxed text-foreground/55">
                  Registrar un cobro confirma una verificación real. Devolver
                  dinero y registrar el retorno físico son operaciones
                  distintas.
                </p>
                <form
                  onSubmit={(event) => void perform(event)}
                  className="mt-5 space-y-4"
                  aria-busy={write.isPending}
                >
                  <label className="block text-sm">
                    Acción
                    <select
                      aria-label="Acción"
                      className={`${commerceInput} mt-2`}
                      value={available.includes(action) ? action : ""}
                      onChange={(event) => {
                        setAction(event.target.value);
                        setMessage("");
                      }}
                      required
                      disabled={write.isPending}
                    >
                      <option value="">Elige una acción</option>
                      {available.map((value) => (
                        <option key={value} value={value}>
                          {commandLabels[value] ?? value}
                        </option>
                      ))}
                    </select>
                  </label>
                  {["APPROVE_PAYMENT", "REFUND", "SHIP"].includes(action) && (
                    <label className="block text-sm">
                      {action === "SHIP"
                        ? "Referencia de seguimiento"
                        : "Referencia real de la operación"}
                      <input
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        maxLength={240}
                        className={`${commerceInput} mt-2`}
                        disabled={write.isPending}
                        required
                      />
                    </label>
                  )}
                  <button
                    disabled={!available.includes(action) || write.isPending}
                    className={`${commercePrimary} w-full`}
                  >
                    {write.isPending
                      ? "Registrando operación…"
                      : "Confirmar acción"}
                  </button>
                  {available.length === 0 && (
                    <p className="text-sm text-foreground/50">
                      No hay transiciones disponibles para el estado actual.
                    </p>
                  )}
                  {message && (
                    <p
                      role="status"
                      className="rounded-xl bg-foreground/5 p-4 text-sm"
                    >
                      {message}
                    </p>
                  )}
                </form>
              </Panel>
            </div>
          </div>
          <Dialog
            open={!!proof}
            onOpenChange={(open) => {
              if (!open) setProof(null);
            }}
          >
            <DialogContent>
              <DialogTitle>Comprobante privado</DialogTitle>
              <DialogDescription>
                Documento del pedido {order.number}. Solo visible para la
                administración autorizada.
              </DialogDescription>
              {proof && <PrivateProof key={proof} id={proof} />}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
