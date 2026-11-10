"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { validateStoreAdminForm } from "@/lib/store-validation";
import {
  commandLabels,
  orderActionOptions,
  orderActionFeedback,
  orderCommandBody,
} from "@/features/store-admin/api/operations";
import { OrderSummary, OrderView, orderLabels } from "./store-orders";
import { storeButton, storeInput, storeMoney } from "./store-ui";

export function StoreAdminOrders({
  allowConfiguration = true,
  initialOrderId,
  configurationOnly = false,
}: {
  allowConfiguration?: boolean;
  initialOrderId?: string;
  configurationOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [orders, setOrders] = useState<
    Pick<
      OrderView,
      "id" | "number" | "status" | "paymentStatus" | "totalAmount"
    >[]
  >([]);
  const [selected, setSelected] = useState<OrderView | null>(null);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [integration, setIntegration] = useState<{
    configured: boolean;
    merchantId?: string;
    webhookUrl?: string;
    liveMode?: boolean;
  } | null>(null);
  const [events, setEvents] = useState<
    { id: string; providerPaymentId: string; detail: unknown }[]
  >([]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!configurationOnly)
        setOrders(
          await apiFetch<typeof orders>(`/store-admin/orders?page=${page}`),
        );
      if (allowConfiguration)
        setIntegration(
          await apiFetch<typeof integration>("/store-admin/integration"),
        );
      if (!configurationOnly)
        setEvents(await apiFetch<typeof events>("/store-admin/payment-events"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [page, allowConfiguration, configurationOnly]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!initialOrderId) return;
    setSelected(null);
    setReference("");
    setReason("");
    setProof(null);
    const controller = new AbortController();
    void apiFetch<OrderView>(
      `/store-admin/orders/${encodeURIComponent(initialOrderId)}`,
      { signal: controller.signal },
    )
      .then(setSelected)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el pedido",
          );
      });
    return () => controller.abort();
  }, [initialOrderId]);
  const open = async (id: string, preserveInput = false) => {
    setProof(null);
    if (!preserveInput) {
      setReference("");
      setReason("");
      setMessage("");
    }
    try {
      setSelected(await apiFetch<OrderView>(`/store-admin/orders/${id}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar");
    }
  };
  const action = async (value: string) => {
    if (!selected || busy) return;
    if (
      !orderActionOptions(selected).some(
        (option) => option.action === value && option.enabled,
      )
    )
      return;
    const command = orderCommandBody(
      value,
      selected.version,
      reference,
      reason,
    );
    if (command.error) {
      setMessage(command.error);
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch<OrderView>(
        `/store-admin/orders/${selected.id}${value === "REFUND" ? "/refund" : ""}`,
        {
          method: value === "REFUND" ? "POST" : "PATCH",
          body: JSON.stringify(command.body),
        },
      );
      setSelected(result);
      await queryClient.invalidateQueries({ queryKey: ["store-admin"] });
      setReference("");
      setReason("");
      setMessage(orderActionFeedback(value, result));
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo completar",
      );
      await open(selected.id, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-5" aria-busy={loading}>
      {!configurationOnly && (
        <div className="flex justify-between">
          <h2 className="font-display text-2xl font-bold">
            Pedidos de tu tienda
          </h2>
          <button onClick={() => void load()} className="text-teal-900">
            Actualizar
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-teal-50 p-4">
          {message}
        </p>
      )}
      {!configurationOnly && (
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-3">
            {loading && (
              <p role="status" className="rounded-xl border p-4">
                Cargando pedidos…
              </p>
            )}
            {!loading && orders.length === 0 && !message && (
              <p className="rounded-xl border p-4 text-sm text-stone-500">
                No hay pedidos en esta página.
              </p>
            )}
            {orders.map((order) => (
              <button
                key={order.id}
                className="block w-full rounded-xl border bg-white p-4 text-left"
                onClick={() => void open(order.id)}
              >
                <strong>{order.number}</strong>
                <p className="mt-1 text-sm text-stone-500">
                  {orderLabels[order.status]} ·{" "}
                  {orderLabels[order.paymentStatus]} ·{" "}
                  {storeMoney(order.totalAmount)}
                </p>
              </button>
            ))}
            <div className="flex gap-4">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Anterior
              </button>
              <span>{page}</span>
              <button
                disabled={orders.length < 30}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
          {selected && (
            <article className="rounded-2xl border bg-white p-6">
              <h3 className="mb-5 font-display text-xl font-bold">
                {selected.number}
              </h3>
              <OrderSummary order={selected} />
              {selected.refundRequestedAt && (
                <p className="my-4 rounded-xl bg-amber-50 p-3">
                  Solicitud de devolución: {selected.refundReason}
                </p>
              )}
              <div className="my-5 flex flex-wrap gap-3">
                {selected.proofs.map((p, i) => (
                  <button
                    key={p.id}
                    className="text-sm text-teal-900 underline"
                    onClick={() =>
                      void apiFetch<{ image: string }>(
                        `/store-admin/proofs/${p.id}`,
                      )
                        .then((result) => setProof(result.image))
                        .catch((e: Error) => setMessage(e.message))
                    }
                  >
                    Ver comprobante {i + 1}
                  </button>
                ))}
              </div>
              {proof && (
                <div className="my-4">
                  <img
                    src={proof}
                    alt="Comprobante privado del pedido"
                    className="max-h-80 max-w-full object-contain"
                  />
                  <button
                    className="mt-2 text-sm"
                    onClick={() => setProof(null)}
                  >
                    Ocultar comprobante
                  </button>
                </div>
              )}
              <label className="block text-sm">
                Referencia del cobro, devolución o seguimiento
                <input
                  className={`${storeInput} mt-2`}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={240}
                />
              </label>
              <label className="mt-4 block text-sm">
                Motivo para el comprador (rechazo o cancelación)
                <textarea
                  aria-label="Motivo para el comprador"
                  className={`${storeInput} mt-2`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={5}
                  maxLength={500}
                  rows={3}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                {orderActionOptions(selected).map((option) => (
                  <button
                    key={option.action}
                    disabled={busy || !option.enabled}
                    title={option.reason ?? undefined}
                    className="rounded-lg border px-3 py-2 text-xs font-medium text-teal-950 disabled:opacity-50"
                    onClick={() => void action(option.action)}
                  >
                    {commandLabels[option.action]}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-stone-500">
                Registra un cobro solo después de verificarlo. Devolver dinero
                no repone mercadería: registra el retorno físico por separado.
              </p>
            </article>
          )}
        </div>
      )}
      {allowConfiguration && (
        <details className="rounded-2xl border bg-white p-6">
          <summary className="cursor-pointer font-semibold">
            Integración Mercado Pago de esta empresa
          </summary>
          <p className="mt-4 text-sm">
            {integration?.configured
              ? `Comercio verificado: ${integration.merchantId} · ${integration.liveMode ? "Producción" : "Pruebas"}`
              : "Sin configurar"}
          </p>
          {integration?.webhookUrl && (
            <p className="mt-3 break-all text-xs">
              Webhook: {integration.webhookUrl}
            </p>
          )}
          <form
            className="store-form mt-5"
            aria-busy={busy}
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              if (busy) return;
              const validated = validateStoreAdminForm("integration", {
                accessToken: data.get("accessToken"),
                webhookSecret: data.get("webhookSecret"),
                liveMode: data.get("liveMode") === "on",
                enabled: data.get("enabled") === "on",
              });
              if (Object.keys(validated.errors).length) {
                setMessage(
                  "Revisa el token de acceso y el secreto de webhook. No incluyas espacios ni caracteres de control.",
                );
                return;
              }
              setBusy(true);
              try {
                await apiFetch("/store-admin/integration", {
                  method: "POST",
                  body: JSON.stringify(validated.data),
                });
                form.reset();
                await load();
                setMessage("Comercio verificado e integración guardada");
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "No se pudo verificar el comercio",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              aria-label="Access token del comercio"
              className={storeInput}
              type="password"
              name="accessToken"
              placeholder="Access token del comercio"
              autoComplete="new-password"
              minLength={10}
              maxLength={1000}
              disabled={busy}
              required
            />
            <input
              aria-label="Secreto de webhook del comercio"
              className={storeInput}
              type="password"
              name="webhookSecret"
              placeholder="Secreto del webhook"
              autoComplete="new-password"
              minLength={10}
              maxLength={500}
              disabled={busy}
              required
            />
            <label className="flex gap-2">
              <input name="liveMode" type="checkbox" />
              Modo producción
            </label>
            <label className="flex gap-2">
              <input name="enabled" type="checkbox" defaultChecked />
              Habilitada
            </label>
            <button disabled={busy} className={storeButton}>
              Verificar y guardar integración
            </button>
          </form>
        </details>
      )}
      {events.length > 0 && (
        <aside className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold">Pagos que requieren conciliación</h3>
          {events.map((e) => (
            <div key={e.id} className="mt-3 text-sm">
              <strong>Pago {e.providerPaymentId}</strong>
              <p className="break-all">{JSON.stringify(e.detail)}</p>
            </div>
          ))}
          <p className="mt-3 text-xs">
            Revisa cobros adicionales o parciales en la cuenta del comercio
            antes de cualquier devolución.
          </p>
        </aside>
      )}
    </section>
  );
}
