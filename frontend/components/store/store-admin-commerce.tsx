"use client";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Methods } from "./store-commerce";
import { storeButton, storeInput, storeMoney } from "./store-ui";

export function StoreAdminCommerce() {
  const [methods, setMethods] = useState<Methods>({
    payment: [],
    shipping: [],
  });
  const [settings, setSettings] = useState<{
    checkoutEnabled: boolean;
    taxRate: string;
    pricesIncludeTax: boolean;
    reservationMinutes: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const load = async () => {
    try {
      setMethods(await apiFetch<Methods>("/store-admin/methods"));
      setSettings(await apiFetch<typeof settings>("/store-admin/settings"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async (
    event: FormEvent<HTMLFormElement>,
    path: string,
    transform: (data: Record<string, FormDataEntryValue>) => unknown,
    method = "POST",
  ) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await apiFetch(`/store-admin/${path}`, {
        method,
        body: JSON.stringify(transform(data)),
      });
      setMessage("Cambios guardados");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar");
    }
  };
  return (
    <section className="space-y-6">
      <h2 className="font-display text-2xl font-bold">
        Compra, pago y entrega
      </h2>
      {message && <p role="status">{message}</p>}
      {settings && (
        <form
          key={JSON.stringify(settings)}
          className="space-y-3 rounded-2xl border bg-white p-6"
          onSubmit={(event) =>
            void save(
              event,
              "commerce",
              (d) => ({
                checkoutEnabled: d.checkoutEnabled === "on",
                pricesIncludeTax: d.pricesIncludeTax === "on",
                taxRate: Number(d.taxRate),
                reservationMinutes: Number(d.reservationMinutes),
              }),
              "PATCH",
            )
          }
        >
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="checkoutEnabled"
              defaultChecked={settings.checkoutEnabled}
            />
            Habilitar compras
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="pricesIncludeTax"
              defaultChecked={settings.pricesIncludeTax}
            />
            Los precios incluyen impuestos
          </label>
          <label className="block text-sm">
            Impuesto (%)
            <input
              className={storeInput}
              name="taxRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={settings.taxRate}
              required
            />
          </label>
          <label className="block text-sm">
            Reserva (minutos)
            <input
              className={storeInput}
              name="reservationMinutes"
              type="number"
              min={5}
              max={1440}
              defaultValue={settings.reservationMinutes}
              required
            />
          </label>
          <button className={storeButton}>Guardar reglas</button>
        </form>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <form
          className="space-y-3 rounded-2xl border bg-white p-6"
          onSubmit={(event) =>
            void save(event, "payment-methods", (d) => ({
              ...d,
              enabled: d.enabled === "on",
            }))
          }
        >
          <h3 className="font-semibold">Método de pago</h3>
          <select aria-label="Tipo de pago" className={storeInput} name="code">
            {["TRANSFER", "YAPE", "PLIN", "CASH_ON_PICKUP", "MERCADOPAGO"].map(
              (code) => (
                <option key={code}>{code}</option>
              ),
            )}
          </select>
          <input
            aria-label="Nombre del pago"
            name="label"
            className={storeInput}
            placeholder="Nombre del método"
            required
          />
          <textarea
            aria-label="Instrucciones de pago"
            name="instructions"
            className={storeInput}
            placeholder="Cuenta, teléfono o instrucciones públicas"
            required
          />
          <label className="flex gap-2">
            <input type="checkbox" name="enabled" defaultChecked />
            Habilitado
          </label>
          <button className={storeButton}>Guardar método</button>
          <p className="text-xs text-stone-500">
            Guardar el mismo tipo actualiza sus instrucciones. Mercado Pago
            además requiere configurar la integración.
          </p>
        </form>
        <form
          className="space-y-3 rounded-2xl border bg-white p-6"
          onSubmit={(event) =>
            void save(event, "shipping-methods", (d) => ({
              kind: d.kind,
              label: d.label,
              fee: Number(d.fee),
              districts: String(d.districts)
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              pickupAddress: d.pickupAddress || undefined,
              enabled: d.enabled === "on",
            }))
          }
        >
          <h3 className="font-semibold">Método de entrega</h3>
          <select
            name="kind"
            aria-label="Tipo de entrega"
            className={storeInput}
          >
            <option value="PICKUP">Retiro</option>
            <option value="DELIVERY">Entrega local</option>
          </select>
          <input
            aria-label="Nombre del envío"
            name="label"
            className={storeInput}
            placeholder="Nombre"
            required
          />
          <input
            aria-label="Tarifa de envío"
            name="fee"
            className={storeInput}
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
          />
          <input
            aria-label="Distritos de cobertura"
            name="districts"
            className={storeInput}
            placeholder="Ubigeos separados por coma"
          />
          <input
            aria-label="Dirección de retiro"
            name="pickupAddress"
            className={storeInput}
            placeholder="Dirección de retiro"
          />
          <label className="flex gap-2">
            <input type="checkbox" name="enabled" defaultChecked />
            Habilitado
          </label>
          <button className={storeButton}>Agregar entrega</button>
        </form>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {methods.payment.map((m) => (
          <article key={m.id} className="rounded-xl border bg-white p-4">
            <strong>{m.label}</strong>
            <p className="text-sm">{m.instructions}</p>
            <button
              className="mt-2 text-sm text-teal-900"
              onClick={() =>
                void apiFetch("/store-admin/payment-methods", {
                  method: "POST",
                  body: JSON.stringify({
                    code: m.code,
                    label: m.label,
                    instructions: m.instructions,
                    enabled: !m.enabled,
                  }),
                })
                  .then(load)
                  .catch((e: Error) => setMessage(e.message))
              }
            >
              {m.enabled ? "Deshabilitar" : "Habilitar"}
            </button>
          </article>
        ))}
        {methods.shipping.map((m) => (
          <article key={m.id} className="rounded-xl border bg-white p-4">
            <strong>{m.label}</strong>
            <p>
              {storeMoney(m.fee)} · {m.kind}
            </p>
            <button
              className="mt-2 text-sm text-teal-900"
              onClick={() =>
                void apiFetch(`/store-admin/shipping-methods/${m.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    kind: m.kind,
                    label: m.label,
                    fee: Number(m.fee),
                    districts: m.districts,
                    pickupAddress: m.pickupAddress ?? undefined,
                    enabled: !m.enabled,
                  }),
                })
                  .then(load)
                  .catch((e: Error) => setMessage(e.message))
              }
            >
              {m.enabled ? "Deshabilitar" : "Habilitar"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
