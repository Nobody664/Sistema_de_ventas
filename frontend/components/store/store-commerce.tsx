"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  Store,
  CreditCard,
} from "lucide-react";
import { storeApi } from "@/lib/store-api";
import {
  addStoreQuantity,
  cartQuantity,
  storeQuantity,
  type StoreCart,
} from "@/lib/store-cart";
import { storeButton, storeInput, storeMoney } from "./store-ui";
import { StoreProductImage } from "./store-product-image";

export interface StoreQuoteView {
  id: string;
  expiresAt: string;
  snapshot: {
    totalAmount: string;
    subtotal: string;
    shippingAmount: string;
    taxAmount: string;
    payment: { code: string; label?: string; instructions: string };
    shipping?: { label: string; kind: string; pickupAddress?: string };
    currency?: string;
    lines: { name: string; quantity: string; totalPrice: string }[];
  };
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
  cart,
  onCartChange,
  currency,
  checkoutEnabled,
}: {
  section: string;
  slug: string;
  onMessage: (text: string) => void;
  cart: StoreCart | null;
  onCartChange: (cart: StoreCart) => void;
  currency: string;
  checkoutEnabled: boolean;
}) {
  const [methods, setMethods] = useState<Methods>({
    payment: [],
    shipping: [],
  });
  const [addresses, setAddresses] = useState<
    {
      id: string;
      label: string;
      street: string;
      district: string;
      isDefault?: boolean;
    }[]
  >([]);
  const [quote, setQuote] = useState<StoreQuoteView | null>(null);
  const [busy, setBusy] = useState(false);
  const updating = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [shippingId, setShippingId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [profileReady, setProfileReady] = useState(true);
  const [now, setNow] = useState(Date.now());
  const selectedShipping = methods.shipping.find(
    (method) => method.id === shippingId,
  );
  const delivery = selectedShipping?.kind === "DELIVERY";
  const paymentOptions = methods.payment.filter(
    (method) => !delivery || method.code !== "CASH_ON_PICKUP",
  );
  const selectedPayment = paymentOptions.find(
    (method) => method.id === paymentId,
  );
  const coveredAddresses = addresses.filter((address) =>
    selectedShipping?.districts.includes(address.district),
  );
  const subtotal =
    cart?.items.reduce(
      (total, line) => total + Number(line.quantity) * Number(line.unitPrice),
      0,
    ) ?? 0;
  const quoteExpired = !!quote && new Date(quote.expiresAt).getTime() <= now;
  const load = useCallback(async () => {
    if (!["carrito", "pago", "envio"].includes(section)) return;
    setLoading(true);
    setQuote(null);
    setLoadError("");
    try {
      const available = await storeApi<Methods>(slug, "methods");
      const enabled = {
        payment: available.payment.filter((method) => method.enabled),
        shipping: available.shipping.filter((method) => method.enabled),
      };
      setMethods(enabled);
      setShippingId((current) =>
        enabled.shipping.some((method) => method.id === current)
          ? current
          : (enabled.shipping[0]?.id ?? ""),
      );
      if (section === "carrito") {
        const [c, me] = await Promise.all([
          storeApi<StoreCart>(slug, "cart"),
          storeApi<{
            addresses: typeof addresses;
            documentValue?: string;
            phone?: string;
            lastName?: string;
          }>(slug, "me"),
        ]);
        onCartChange(c);
        setAddresses(me.addresses);
        setProfileReady(
          !!me.lastName && !!me.phone && /^\d{8}$/.test(me.documentValue ?? ""),
        );
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "No se pudo cargar",
      );
    } finally {
      setLoading(false);
    }
  }, [section, slug, onCartChange]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!quote) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quote]);
  const update = async (line: StoreCart["items"][number], quantity: number) => {
    if (!cart || updating.current) return;
    updating.current = true;
    setBusy(true);
    setQuote(null);
    try {
      const updated = await storeApi<StoreCart>(slug, "cart/items", {
        version: cart.version,
        productId: line.productId,
        ...(line.presentationId ? { presentationId: line.presentationId } : {}),
        quantity,
      });
      onCartChange(updated);
      onMessage(
        quantity === 0
          ? "Producto retirado del carrito"
          : "Cantidad actualizada",
      );
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "No se pudo actualizar",
      );
      await load();
    } finally {
      updating.current = false;
      setBusy(false);
    }
  };
  const calculate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cart) return;
    setBusy(true);
    setQuote(null);
    try {
      setQuote(
        await storeApi<StoreQuoteView>(slug, "checkout/quote", {
          cartVersion: cart.version,
          paymentMethodId: paymentId,
          shippingMethodId: shippingId,
          ...(delivery && addressId ? { addressId } : {}),
        }),
      );
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No se pudo cotizar");
    } finally {
      setBusy(false);
    }
  };
  if (!["carrito", "pago", "envio"].includes(section)) return null;
  if (loading)
    return (
      <section
        role="status"
        className="flex min-h-48 items-center justify-center gap-3 text-stone-500"
      >
        <Loader2 className="size-5 animate-spin" />
        Cargando tu compra y las opciones de la tienda…
      </section>
    );
  if (loadError)
    return (
      <section
        role="alert"
        className="rounded-2xl border border-amber-300 bg-white p-6"
      >
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className={`${storeButton} mt-4`}
        >
          Volver a cargar
        </button>
      </section>
    );
  if (section === "pago" || section === "envio")
    return (
      <section>
        <h1 className="mb-6 font-display text-3xl font-bold">
          {section === "pago" ? "Cómo pagar" : "Cómo recibir tu compra"}
        </h1>
        <div className="grid gap-4 md:grid-cols-2">
          {!(section === "pago"
            ? methods.payment.length
            : methods.shipping.length) && (
            <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-stone-500">
              La compañía todavía no tiene opciones habilitadas. Contacta con la
              tienda antes de comprar.
            </p>
          )}
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
                    Tarifa de referencia: {storeMoney(m.fee, currency)}
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
      <ol className="store-checkout-steps" aria-label="Pasos de la compra">
        <li data-active="true">
          01 <span>Tu carrito</span>
        </li>
        <li data-active={!!selectedShipping}>
          02 <span>Entrega y pago</span>
        </li>
        <li data-active={!!quote}>
          03 <span>Confirmación</span>
        </li>
      </ol>
      <Link
        href={`/tienda/${slug}/catalogo`}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-teal-800"
      >
        <ArrowLeft className="size-4" />
        Seguir comprando
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">Tu carrito</h1>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-900">
          {storeQuantity(cartQuantity(cart))} seleccionados
        </span>
      </div>
      <p className="mt-2 text-stone-500">
        Agregar productos no reserva existencias. Revisa la cotización antes de
        confirmar.
      </p>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          {cart?.items.map((line) => (
            <article
              key={line.productId}
              className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5"
            >
              <StoreProductImage src={line.imageUrl} name={line.name} compact />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">
                  {line.name}{" "}
                  {line.presentationName && `· ${line.presentationName}`}
                </h2>
                <p className="mt-2 text-stone-500">
                  {storeQuantity(line.quantity)} ×{" "}
                  {storeMoney(line.unitPrice, currency)}{" "}
                  {line.unavailable && "· Ya no disponible"}
                </p>
                <p className="mt-2 font-semibold tabular-nums">
                  {storeMoney(
                    Number(line.quantity) * Number(line.unitPrice),
                    currency,
                  )}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <CartQuantity
                    line={line}
                    busy={busy}
                    onChange={(quantity) => void update(line, quantity)}
                  />
                  <button
                    disabled={busy}
                    type="button"
                    aria-label={`Retirar ${line.name}`}
                    className="inline-flex items-center gap-1.5 text-sm text-red-700 disabled:opacity-40"
                    onClick={() => void update(line, 0)}
                  >
                    <Trash2 className="size-4" />
                    Retirar
                  </button>
                </div>
              </div>
            </article>
          ))}
          {cart && !cart.items.length && (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
              <ShoppingBag className="mx-auto mb-4 size-10 text-stone-400" />
              <p className="mb-3 font-semibold">Tu carrito está vacío.</p>
              <Link
                className="text-teal-900 underline"
                href={`/tienda/${slug}/catalogo`}
              >
                Explorar productos
              </Link>
            </div>
          )}
        </div>
        <div className="self-start lg:sticky lg:top-32">
          <form
            onSubmit={(event) => void calculate(event)}
            onChange={() => setQuote(null)}
            className="store-form store-form-panel"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-4 text-sm">
              <span>Productos · {cart?.items.length ?? 0}</span>
              <strong className="text-xl tabular-nums">
                {storeMoney(subtotal, currency)}
              </strong>
            </div>
            <h2 className="font-display text-xl font-bold">
              Prepara tu compra
            </h2>
            {!checkoutEnabled && (
              <p
                role="alert"
                className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
              >
                La compañía ha pausado la recepción de pedidos.
              </p>
            )}
            <fieldset className="store-option-group">
              <legend>¿Cómo quieres recibirlo?</legend>
              {methods.shipping.map((method) => (
                <label
                  key={method.id}
                  className="store-option"
                  data-selected={method.id === shippingId}
                >
                  <input
                    type="radio"
                    name="shippingMethodId"
                    value={method.id}
                    checked={method.id === shippingId}
                    disabled={busy}
                    aria-label={method.label}
                    onChange={() => {
                      setShippingId(method.id);
                      setAddressId("");
                      if (
                        method.kind === "DELIVERY" &&
                        selectedPayment?.code === "CASH_ON_PICKUP"
                      )
                        setPaymentId("");
                    }}
                  />
                  {method.kind === "PICKUP" ? (
                    <Store className="size-5 shrink-0" />
                  ) : (
                    <Truck className="size-5 shrink-0" />
                  )}
                  <span>
                    <strong>{method.label}</strong>
                    <small>
                      {method.kind === "PICKUP"
                        ? method.pickupAddress
                        : `Cobertura: ${method.districts.join(", ")}`}
                    </small>
                  </span>
                  <b>
                    {Number(method.fee) === 0
                      ? "Gratis"
                      : storeMoney(method.fee, currency)}
                  </b>
                </label>
              ))}
            </fieldset>
            {!methods.shipping.length && (
              <p className="text-sm text-amber-700">
                La compañía no tiene formas de entrega habilitadas.
              </p>
            )}
            {delivery && (
              <label className="block text-sm">
                Dirección de entrega
                <select
                  required
                  disabled={busy}
                  name="addressId"
                  className={storeInput}
                  value={addressId}
                  onChange={(event) => setAddressId(event.target.value)}
                >
                  <option value="">
                    Selecciona una dirección con cobertura
                  </option>
                  {coveredAddresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}: {a.street}
                    </option>
                  ))}
                </select>
                {!coveredAddresses.length && (
                  <span className="mt-2 block text-amber-700">
                    {addresses.length
                      ? "Tus direcciones no tienen cobertura para esta entrega. Elige otra opción o agrega una dirección."
                      : "Agrega una dirección para recibir tu compra."}
                  </span>
                )}
              </label>
            )}
            {delivery && (
              <Link
                href={`/tienda/${slug}/direcciones`}
                className="block text-sm text-teal-900 underline"
              >
                Administrar direcciones
              </Link>
            )}
            <fieldset className="store-option-group">
              <legend>¿Cómo prefieres pagar?</legend>
              {paymentOptions.map((method) => (
                <label
                  key={method.id}
                  className="store-option"
                  data-selected={method.id === paymentId}
                >
                  <input
                    type="radio"
                    name="paymentMethodId"
                    value={method.id}
                    checked={method.id === paymentId}
                    disabled={busy}
                    aria-label={method.label}
                    onChange={() => setPaymentId(method.id)}
                  />
                  <CreditCard className="size-5 shrink-0" />
                  <span>
                    <strong>{method.label}</strong>
                    <small>
                      {method.code === "MERCADOPAGO"
                        ? "Pago en la plataforma del proveedor"
                        : "Sigue las instrucciones de la tienda"}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            {delivery &&
              methods.payment.some(
                (method) => method.code === "CASH_ON_PICKUP",
              ) && (
                <p className="text-xs text-stone-500">
                  El pago en efectivo solo está disponible para retiro en local.
                </p>
              )}
            {selectedPayment && (
              <div className="flex gap-3 rounded-xl border border-stone-200 p-4 text-sm">
                <CreditCard className="mt-0.5 size-5 shrink-0 text-teal-800" />
                <p className="whitespace-pre-wrap text-stone-600">
                  {selectedPayment.instructions ||
                    "La tienda indicará los pasos para completar este pago."}
                </p>
              </div>
            )}
            {!paymentOptions.length && (
              <p className="text-sm text-amber-700">
                No hay formas de pago disponibles para esta entrega.
              </p>
            )}
            <p className="text-xs leading-relaxed text-stone-500">
              El total final, los impuestos y el envío se validan con la
              compañía al calcular tu compra.
            </p>
            {!profileReady && (
              <div className="store-inline-notice">
                <p>
                  Completa tu DNI, apellidos y teléfono antes de confirmar una
                  compra.
                </p>
                <Link href={`/tienda/${slug}/perfil`}>
                  Completar mi perfil →
                </Link>
              </div>
            )}
            <button
              disabled={
                busy ||
                !checkoutEnabled ||
                !profileReady ||
                !cart?.items.length ||
                cart.items.some((line) => line.unavailable) ||
                !selectedPayment ||
                !selectedShipping ||
                (delivery &&
                  !coveredAddresses.some((address) => address.id === addressId))
              }
              className={`${storeButton} w-full`}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}Calcular
              total
            </button>
          </form>
          {quote && (
            <div className="mt-4 space-y-3 rounded-2xl bg-teal-950 p-6 text-white">
              <h2 className="font-display text-xl font-bold">Cotización</h2>
              {quote.snapshot.lines.map((line, index) => (
                <div
                  key={`${line.name}-${index}`}
                  className="flex items-start justify-between gap-4 text-sm text-teal-100"
                >
                  <span>
                    {storeQuantity(line.quantity)} × {line.name}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {storeMoney(line.totalPrice, currency)}
                  </span>
                </div>
              ))}
              {quote.snapshot.shipping && (
                <p className="text-sm text-teal-100">
                  {quote.snapshot.shipping.label}
                  {quote.snapshot.shipping.kind === "PICKUP" &&
                    ` · ${quote.snapshot.shipping.pickupAddress ?? ""}`}
                </p>
              )}
              <p className="text-sm text-teal-100">
                Pago: {quote.snapshot.payment.label ?? selectedPayment?.label}
              </p>
              <p>Productos: {storeMoney(quote.snapshot.subtotal, currency)}</p>
              <p>
                Envío sin impuestos:{" "}
                {storeMoney(quote.snapshot.shippingAmount, currency)}
              </p>
              <p>Impuestos: {storeMoney(quote.snapshot.taxAmount, currency)}</p>
              <p className="border-t border-white/20 pt-3 text-2xl font-semibold">
                Total: {storeMoney(quote.snapshot.totalAmount, currency)}
              </p>
              <p className="text-xs text-teal-200">
                Válida hasta{" "}
                {new Date(quote.expiresAt).toLocaleTimeString("es-PE")}.
              </p>
              {quoteExpired ? (
                <p role="status" className="rounded-xl bg-white/10 p-3 text-sm">
                  La cotización venció. Calcula el total nuevamente para
                  continuar.
                </p>
              ) : (
                <StoreConfirm slug={slug} quote={quote} onMessage={onMessage} />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CartQuantity({
  line,
  busy,
  onChange,
}: {
  line: StoreCart["items"][number];
  busy: boolean;
  onChange: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState(line.quantity);
  const step =
    line.presentationId || !line.baseUnit || line.baseUnit === "UNIT"
      ? 1
      : 0.001;
  useEffect(() => setDraft(line.quantity), [line.quantity]);
  const commit = () => {
    const value = Number(draft);
    if (
      !draft.trim() ||
      !Number.isFinite(value) ||
      value < step ||
      (step === 1 && !Number.isInteger(value)) ||
      Math.abs(Math.round(value * 1000) - value * 1000) > 0.000001
    ) {
      setDraft(line.quantity);
      return;
    }
    if (value !== Number(line.quantity)) onChange(value);
  };
  return (
    <div className="inline-flex items-center rounded-xl border border-stone-300 bg-white">
      <button
        type="button"
        disabled={busy || line.unavailable || Number(line.quantity) <= step}
        aria-label={`Disminuir ${line.name}`}
        onClick={() =>
          onChange(Math.max(step, addStoreQuantity(line.quantity, -step)))
        }
        className="p-3 text-teal-900 disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <input
        aria-label={`Cantidad en carrito de ${line.name}`}
        type="number"
        min={step}
        step={step}
        value={draft}
        disabled={busy || line.unavailable}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="w-16 bg-transparent py-2 text-center text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-inset focus:ring-teal-700"
      />
      <button
        type="button"
        disabled={busy || line.unavailable}
        aria-label={`Aumentar ${line.name}`}
        onClick={() => onChange(addStoreQuantity(line.quantity, step))}
        className="p-3 text-teal-900 disabled:opacity-30"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function StoreConfirm({
  slug,
  quote,
  onMessage,
}: {
  slug: string;
  quote: StoreQuoteView;
  onMessage: (text: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const key = useRef<{ quote: string; key: string } | null>(null);
  return (
    <button
      disabled={busy || new Date(quote.expiresAt) <= new Date()}
      className="w-full rounded-xl bg-white px-5 py-3 font-semibold text-teal-950 disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        if (key.current?.quote !== quote.id)
          key.current = { quote: quote.id, key: crypto.randomUUID() };
        try {
          const order = await storeApi<{ id: string }>(slug, "orders", {
            quoteId: quote.id,
            idempotencyKey: key.current.key,
          });
          router.push(`/tienda/${slug}/pedidos/${order.id}`);
        } catch (error) {
          onMessage(
            error instanceof Error ? error.message : "No se pudo confirmar",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Confirmando…" : "Confirmar pedido con este total"}
    </button>
  );
}
