"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { storeApi } from "@/lib/store-api";
import { storeButton, storeInput, storeMoney } from "./store-ui";

export interface StoreQuoteView {
  id: string;
  expiresAt: string;
  snapshot: {
    totalAmount: string;
    subtotal: string;
    shippingAmount: string;
    taxAmount: string;
    payment: { code: string; instructions: string };
    lines: { name: string; quantity: string; totalPrice: string }[];
  };
}
interface Cart {
  version: number;
  items: {
    productId: string;
    presentationId: string | null;
    name: string;
    quantity: string;
    unitPrice: string;
    presentationName: string | null;
    unavailable: boolean;
  }[];
}
export interface Methods {
  payment: {
    id: string;
    code: string;
    label: string;
    instructions: string;
    enabled: boolean;
  }[];
  shipping: {
    id: string;
    kind: string;
    label: string;
    fee: string;
    districts: string[];
    pickupAddress: string;
    enabled: boolean;
  }[];
}

export function StoreCommerce({
  section,
  slug,
  onMessage,
}: {
  section: string;
  slug: string;
  onMessage: (text: string) => void;
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [methods, setMethods] = useState<Methods>({
    payment: [],
    shipping: [],
  });
  const [addresses, setAddresses] = useState<
    { id: string; label: string; street: string }[]
  >([]);
  const [quote, setQuote] = useState<StoreQuoteView | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!["carrito", "pago", "envio"].includes(section)) return;
    try {
      setMethods(await storeApi<Methods>(slug, "methods"));
      if (section === "carrito") {
        const [c, me] = await Promise.all([
          storeApi<Cart>(slug, "cart"),
          storeApi<{ addresses: typeof addresses }>(slug, "me"),
        ]);
        setCart(c);
        setAddresses(me.addresses);
      }
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No se pudo cargar");
    }
  }, [section, slug, onMessage]);
  useEffect(() => {
    void load();
  }, [load]);
  const update = async (line: Cart["items"][number], quantity: number) => {
    if (!cart) return;
    setBusy(true);
    setQuote(null);
    try {
      await storeApi(slug, "cart/items", {
        version: cart.version,
        productId: line.productId,
        ...(line.presentationId ? { presentationId: line.presentationId } : {}),
        quantity,
      });
      await load();
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "No se pudo actualizar",
      );
      await load();
    } finally {
      setBusy(false);
    }
  };
  const calculate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cart) return;
    setBusy(true);
    setQuote(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      setQuote(
        await storeApi<StoreQuoteView>(slug, "checkout/quote", {
          cartVersion: cart.version,
          paymentMethodId: values.paymentMethodId,
          shippingMethodId: values.shippingMethodId,
          ...(values.addressId ? { addressId: values.addressId } : {}),
        }),
      );
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No se pudo cotizar");
    } finally {
      setBusy(false);
    }
  };
  if (section === "pago" || section === "envio")
    return (
      <section>
        <h1 className="mb-6 font-display text-3xl font-bold">
          {section === "pago" ? "Cómo pagar" : "Cómo recibir tu compra"}
        </h1>
        <div className="grid gap-4 md:grid-cols-2">
          {section === "pago"
            ? methods.payment.map((m) => (
                <article key={m.id} className="rounded-2xl border bg-white p-6">
                  <h2 className="font-semibold">{m.label}</h2>
                  <p className="mt-3 whitespace-pre-wrap text-stone-600">
                    {m.instructions}
                  </p>
                </article>
              ))
            : methods.shipping.map((m) => (
                <article key={m.id} className="rounded-2xl border bg-white p-6">
                  <h2 className="font-semibold">{m.label}</h2>
                  <p className="mt-3 text-stone-600">
                    {m.kind === "PICKUP"
                      ? m.pickupAddress
                      : `Cobertura: ${m.districts.join(", ")}`}
                  </p>
                  <p className="mt-3">
                    Tarifa de referencia: {storeMoney(m.fee)}
                  </p>
                </article>
              ))}
        </div>
        <p className="mt-5 text-sm text-stone-500">
          La cotización valida la combinación de pago, dirección y entrega.
        </p>
      </section>
    );
  if (section !== "carrito") return null;
  return (
    <section>
      <h1 className="font-display text-3xl font-bold">Tu carrito</h1>
      <p className="mt-2 text-stone-500">
        Agregar productos no reserva existencias. Revisa la cotización antes de
        confirmar.
      </p>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          {cart?.items.map((line) => (
            <article
              key={line.productId}
              className="rounded-2xl border bg-white p-5"
            >
              <h2 className="font-semibold">
                {line.name}{" "}
                {line.presentationName && `· ${line.presentationName}`}
              </h2>
              <p className="mt-2 text-stone-500">
                {line.quantity} × {storeMoney(line.unitPrice)}{" "}
                {line.unavailable && "· Ya no disponible"}
              </p>
              <div className="mt-4 flex gap-4">
                <button
                  disabled={busy}
                  className="text-teal-900"
                  onClick={() => void update(line, Number(line.quantity) + 1)}
                >
                  + 1
                </button>
                <button
                  disabled={busy}
                  className="text-red-700"
                  onClick={() => void update(line, 0)}
                >
                  Retirar
                </button>
              </div>
            </article>
          ))}
          {cart && !cart.items.length && (
            <p className="rounded-2xl bg-white p-8">
              Tu carrito está vacío.{" "}
              <Link
                className="text-teal-900 underline"
                href={`/tienda/${slug}/catalogo`}
              >
                Explorar productos
              </Link>
            </p>
          )}
        </div>
        <div>
          <form
            onSubmit={(event) => void calculate(event)}
            className="space-y-4 rounded-2xl border bg-white p-6"
          >
            <h2 className="font-display text-xl font-bold">
              Prepara tu compra
            </h2>
            <label className="block text-sm">
              Forma de pago
              <select required name="paymentMethodId" className={storeInput}>
                <option value="">Seleccionar</option>
                {methods.payment.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Forma de entrega
              <select required name="shippingMethodId" className={storeInput}>
                <option value="">Seleccionar</option>
                {methods.shipping.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Dirección (para entrega)
              <select name="addressId" className={storeInput}>
                <option value="">Retiro sin dirección de entrega</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}: {a.street}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href={`/tienda/${slug}/direcciones`}
              className="block text-sm text-teal-900 underline"
            >
              Administrar direcciones
            </Link>
            <button
              disabled={busy || !cart?.items.length}
              className={storeButton}
            >
              Calcular total
            </button>
          </form>
          {quote && (
            <div className="mt-4 space-y-3 rounded-2xl bg-teal-950 p-6 text-white">
              <h2 className="font-display text-xl font-bold">Cotización</h2>
              <p>Productos: {storeMoney(quote.snapshot.subtotal)}</p>
              <p>
                Envío sin impuestos: {storeMoney(quote.snapshot.shippingAmount)}
              </p>
              <p>Impuestos: {storeMoney(quote.snapshot.taxAmount)}</p>
              <p className="border-t border-white/20 pt-3 text-2xl font-semibold">
                Total: {storeMoney(quote.snapshot.totalAmount)}
              </p>
              <p className="text-xs text-teal-200">
                Válida hasta{" "}
                {new Date(quote.expiresAt).toLocaleTimeString("es-PE")}.
              </p>
              <StoreConfirm slug={slug} quote={quote} onMessage={onMessage} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StoreConfirm(_props: {
  slug: string;
  quote: StoreQuoteView;
  onMessage: (text: string) => void;
}) {
  return null;
}
