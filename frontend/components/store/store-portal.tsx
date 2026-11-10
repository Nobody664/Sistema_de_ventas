"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ShoppingBag,
  UserRound,
  MapPin,
  LogOut,
  ShoppingCart,
} from "lucide-react";
import { StoreApiError, storeApi } from "@/lib/store-api";
import { cartQuantity, storeQuantity, type StoreCart } from "@/lib/store-cart";
import { StoreCommerce } from "./store-commerce";
import { StoreCatalog, type StoreProduct } from "./store-catalog";
import { storePageTitle } from "@/lib/store-navigation";
import { validateStoreForm } from "@/lib/store-validation";
import { StoreField } from "./store-field";
import { StoreOrders } from "./store-orders";
import { storeButton } from "./store-ui";
import { StoreBuyerNotifications } from "./store-buyer-notifications";
import type { PublicStoreAppearance } from "@/lib/store-appearance";

interface Address {
  id: string;
  label: string;
  recipient: string;
  street: string;
  district: string;
  phone: string;
  reference?: string;
  isDefault: boolean;
}
interface Profile {
  accountId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentValue?: string;
  addresses: Address[];
}

export function StorePortal({
  slug,
  section,
  detailId,
}: {
  slug: string;
  section: string;
  detailId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const base = `/tienda/${encodeURIComponent(slug)}`;
  const [info, setInfo] = useState<{
    name: string;
    description?: string;
    currency: string;
    checkoutEnabled?: boolean;
    appearance?: PublicStoreAppearance | null;
    phone?: string | null;
  } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const onBuyerSessionChange = useCallback(() => {
    setProfile(null);
    setCart(null);
    setProducts([]);
    setMessage("");
    router.replace(`${base}/ingresar`);
  }, [router, base]);
  useEffect(() => {
    if (info?.name) document.title = storePageTitle(info.name, section);
  }, [info?.name, section]);
  const publicSection = [
    "ingresar",
    "registro",
    "recuperar",
    "verificar",
    "restablecer",
    "privacidad",
  ].includes(section);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!publicSection) {
        const [me, currentCart] = await Promise.all([
          storeApi<Profile>(slug, "me"),
          storeApi<StoreCart>(slug, "cart"),
        ]);
        setProfile(me);
        setCart(currentCart);
        if (section === "catalogo") {
          setCategories(await storeApi<typeof categories>(slug, "categories"));
          if (detailId) {
            setProducts([
              await storeApi<StoreProduct>(
                slug,
                `catalog/${encodeURIComponent(detailId)}`,
              ),
            ]);
            setPages(1);
            return;
          }
          const result = await storeApi<{
            data: StoreProduct[];
            totalPages: number;
          }>(
            slug,
            `catalog?page=${page}&search=${encodeURIComponent(query)}${categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : ""}`,
          );
          setProducts(result.data);
          setPages(result.totalPages);
        }
      }
    } catch (error) {
      if (error instanceof StoreApiError && error.status === 401)
        router.replace(`${base}/ingresar`);
      else
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la tienda",
        );
    } finally {
      setLoading(false);
    }
  }, [
    slug,
    publicSection,
    section,
    page,
    query,
    router,
    base,
    detailId,
    categoryId,
  ]);
  useEffect(() => {
    setMessage("");
    void storeApi<typeof info>(slug, "info")
      .then(setInfo)
      .catch(() => undefined);
    void load();
  }, [slug, load]);

  const submit = async (
    event: FormEvent<HTMLFormElement>,
    path: string,
    transform?: (data: Record<string, FormDataEntryValue>) => unknown,
    method?: string,
  ) => {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const validated = validateStoreForm(
      path,
      transform ? transform(values) : values,
    );
    setFieldErrors(validated.errors);
    if (Object.keys(validated.errors).length) {
      const first = form.elements.namedItem(Object.keys(validated.errors)[0]);
      if (first instanceof HTMLElement) first.focus();
      setMessage(
        validated.errors.token ?? "Revisa los campos señalados para continuar.",
      );
      return;
    }
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await storeApi<{ message?: string }>(
        slug,
        path,
        validated.data,
        method,
      );
      if (path === "auth/login") router.replace(`${base}/catalogo`);
      else {
        if (path === "me/addresses") form.reset();
        setMessage(result.message ?? "Datos guardados");
        await load();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const field = (
    name: string,
    label: string,
    type = "text",
    value?: string,
    required = true,
  ) => (
    <StoreField
      name={name}
      label={label}
      type={type}
      value={value}
      error={fieldErrors[name]}
      disabled={busy}
      required={required}
      newPassword={section === "registro" || section === "restablecer"}
    />
  );

  return (
    <div
      data-store-theme={info?.appearance?.themePreset}
      className="store-portal min-h-screen bg-[#f6f4ef] text-stone-900 dark:bg-slate-950 dark:text-stone-100"
    >
      <header className="store-header">
        <div className="store-header-inner">
          <Link href={`${base}/catalogo`} className="store-brand">
            <span className="rounded-xl bg-teal-900 p-2.5 text-white">
              <ShoppingBag className="size-5" />
            </span>
            <span>
              <span className="store-brand-caption">Tu tienda en línea</span>
              <strong>{info?.name ?? "Tu tienda"}</strong>
            </span>
          </Link>
          <nav
            className="store-navigation"
            aria-label="Navegación de la tienda"
          >
            <Link
              href={`${base}/catalogo`}
              aria-current={section === "catalogo" ? "page" : undefined}
              className={
                section === "catalogo" ? "font-semibold text-teal-800" : ""
              }
            >
              Catálogo
            </Link>
            <Link
              href={`${base}/carrito`}
              aria-label="Carrito"
              aria-current={section === "carrito" ? "page" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-2 font-semibold text-teal-900"
            >
              <ShoppingCart className="size-4" />
              Carrito
              <span
                data-testid="cart-count"
                aria-hidden="true"
                className="min-w-6 rounded-full bg-teal-900 px-1.5 py-0.5 text-center text-xs text-white"
              >
                {storeQuantity(cartQuantity(cart))}
              </span>
            </Link>
            <Link href={`${base}/pedidos`}>Mis pedidos</Link>
            {profile?.accountId && (
              <StoreBuyerNotifications
                key={`${slug}:${profile.accountId}`}
                slug={slug}
                accountId={profile.accountId}
                onNotice={setMessage}
                onSessionChange={onBuyerSessionChange}
              />
            )}
            <Link href={`${base}/pago`}>Pago</Link>
            <Link href={`${base}/envio`}>Envío</Link>
            <Link href={`${base}/perfil`} aria-label="Mi perfil">
              <UserRound className="size-5" />
            </Link>
            {profile && (
              <button
                aria-label="Cerrar sesión comercial"
                onClick={() =>
                  void storeApi(slug, "auth/logout", {})
                    .then(() => {
                      setProfile(null);
                      setCart(null);
                      router.replace(`${base}/ingresar`);
                    })
                    .catch((error: Error) => setMessage(error.message))
                }
              >
                <LogOut className="size-5" />
              </button>
            )}
          </nav>
        </div>
      </header>
      <main
        className="store-main"
        onInputCapture={(event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement && fieldErrors[target.name])
            setFieldErrors((current) => {
              const next = { ...current };
              delete next[target.name];
              return next;
            });
        }}
      >
        {message && (
          <p
            role="status"
            className="mb-6 break-words whitespace-pre-wrap rounded-xl border border-teal-200 bg-white p-4 text-sm text-teal-950"
          >
            {message}
          </p>
        )}
        {publicSection ? (
          <section className="store-account-layout">
            <div className="pt-4">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-800">
                Compra cerca. Compra bien.
              </p>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight">
                Tu cuenta.
                <br />
                Tu tienda de confianza.
              </h1>
              <p className="mt-5 text-stone-600">
                Consulta el catálogo y conserva tus datos de compra dentro de
                esta empresa.
              </p>
              <div className="mt-8 flex gap-4 text-sm font-semibold text-teal-900">
                <Link href={`${base}/ingresar`}>Ingresar</Link>
                <Link href={`${base}/registro`}>Crear cuenta</Link>
                <Link href={`${base}/recuperar`}>Recuperar acceso</Link>
              </div>
            </div>
            <div className="store-form-panel">
              <h2 className="mb-6 font-display text-2xl font-bold">
                {
                  {
                    ingresar: "Bienvenido de nuevo",
                    registro: "Crea tu cuenta",
                    recuperar: "Recupera tu acceso",
                    verificar: "Verifica tu correo",
                    restablecer: "Nueva contraseña",
                    privacidad: "Tus datos en esta tienda",
                  }[section]
                }
              </h2>
              {section === "privacidad" && (
                <div className="space-y-4 text-sm text-stone-600">
                  <p>
                    Esta empresa utiliza los datos de tu cuenta, contacto,
                    documento y dirección para atender tus compras, pagos y
                    entregas.
                  </p>
                  <p>
                    La ficha comercial, las direcciones y los pedidos se
                    mantienen separados de los de otras empresas. Puedes
                    consultar y actualizar tu perfil; para resolver un pedido o
                    solicitar el cierre de la cuenta, contacta al negocio.
                  </p>
                  <p>
                    Conservamos el historial necesario para atender operaciones
                    y sus devoluciones. No guardamos números completos de
                    tarjetas ni CVV en el portal.
                  </p>
                </div>
              )}
              {section === "ingresar" && (
                <form
                  noValidate
                  aria-busy={busy}
                  className="store-form"
                  onSubmit={(event) => void submit(event, "auth/login")}
                >
                  {field("email", "Correo", "email")}
                  {field("password", "Contraseña", "password")}
                  <button disabled={busy} className={storeButton}>
                    {busy ? "Ingresando…" : "Ingresar"}{" "}
                    <ArrowRight className="size-4" />
                  </button>
                </form>
              )}
              {section === "registro" && (
                <form
                  noValidate
                  aria-busy={busy}
                  className="store-form"
                  onSubmit={(event) =>
                    void submit(event, "auth/register", (data) => ({
                      ...data,
                      acceptTerms: data.acceptTerms === "on",
                    }))
                  }
                >
                  {field("firstName", "Nombres")}
                  {field("lastName", "Apellidos")}
                  {field("email", "Correo", "email")}
                  {field(
                    "password",
                    "Contraseña (mínimo 8 caracteres)",
                    "password",
                  )}
                  {field(
                    "passwordConfirmation",
                    "Repite tu contraseña",
                    "password",
                  )}
                  <label className="flex gap-2 text-sm">
                    <input type="checkbox" name="acceptTerms" required />
                    Acepto el registro y tratamiento de mis datos para atender
                    mis compras en esta empresa.
                  </label>
                  {fieldErrors.acceptTerms && (
                    <p role="alert" className="store-field-error">
                      {fieldErrors.acceptTerms}
                    </p>
                  )}
                  <Link
                    href={`${base}/privacidad`}
                    className="block text-xs text-teal-900 underline"
                  >
                    Información sobre el uso de tus datos
                  </Link>
                  <button disabled={busy} className={storeButton}>
                    Crear cuenta
                  </button>
                </form>
              )}
              {section === "recuperar" && (
                <form
                  noValidate
                  aria-busy={busy}
                  className="store-form"
                  onSubmit={(event) =>
                    void submit(event, "auth/forgot-password")
                  }
                >
                  {field("email", "Correo", "email")}
                  <button disabled={busy} className={storeButton}>
                    Enviar instrucciones
                  </button>
                </form>
              )}
              {section === "verificar" && (
                <>
                  <form
                    noValidate
                    aria-busy={busy}
                    className="store-form"
                    onSubmit={(event) =>
                      void submit(event, "auth/verify", () => ({
                        token: searchParams.get("token") ?? "",
                      }))
                    }
                  >
                    <p className="text-sm text-stone-600">
                      Confirma el enlace que recibiste para activar tu cuenta.
                    </p>
                    <button disabled={busy} className={storeButton}>
                      Verificar cuenta
                    </button>
                  </form>
                  <form
                    noValidate
                    aria-busy={busy}
                    className="store-form mt-6"
                    onSubmit={(event) => void submit(event, "auth/resend")}
                  >
                    {field("email", "Correo", "email")}
                    <button
                      disabled={busy}
                      className="text-sm font-semibold text-teal-900"
                    >
                      Reenviar verificación
                    </button>
                  </form>
                </>
              )}
              {section === "restablecer" && (
                <form
                  noValidate
                  aria-busy={busy}
                  className="store-form"
                  onSubmit={(event) =>
                    void submit(event, "auth/reset-password", (data) => ({
                      ...data,
                      token: searchParams.get("token") ?? "",
                    }))
                  }
                >
                  {field("password", "Nueva contraseña", "password")}
                  {field(
                    "passwordConfirmation",
                    "Repite tu contraseña",
                    "password",
                  )}
                  <button disabled={busy} className={storeButton}>
                    Guardar contraseña
                  </button>
                </form>
              )}
            </div>
          </section>
        ) : (
          <>
            {section === "catalogo" && (
              <StoreCatalog
                slug={slug}
                name={info?.name ?? "Tu tienda"}
                appearance={info?.appearance}
                phone={info?.phone}
                description={info?.description}
                products={products}
                categories={categories}
                categoryId={categoryId}
                search={search}
                query={query}
                page={page}
                pages={pages}
                loading={loading}
                detailId={detailId}
                cart={cart}
                onCartChange={setCart}
                onMessage={setMessage}
                onSearchChange={setSearch}
                onSearch={() => {
                  setPage(1);
                  setQuery(search.trim());
                }}
                onCategoryChange={(id) => {
                  setCategoryId(id);
                  setPage(1);
                }}
                onPageChange={setPage}
              />
            )}
            {section === "perfil" && profile && (
              <section className="store-form-panel max-w-2xl">
                <h1 className="mb-6 font-display text-3xl font-bold">
                  Mi perfil
                </h1>
                <p className="mb-5 text-stone-500">{profile.email}</p>
                <p className="store-form-intro">
                  Completa tus datos de contacto para que la tienda pueda
                  preparar y entregar tu pedido.
                </p>
                <form
                  key={JSON.stringify(profile)}
                  noValidate
                  aria-busy={busy}
                  className="store-form store-form-grid"
                  onSubmit={(event) =>
                    void submit(event, "me", undefined, "PATCH")
                  }
                >
                  {field("firstName", "Nombres", "text", profile.firstName)}
                  {field("lastName", "Apellidos", "text", profile.lastName)}
                  {field("documentValue", "DNI", "text", profile.documentValue)}
                  {field("phone", "Teléfono", "tel", profile.phone)}
                  <button disabled={busy} className={storeButton}>
                    Guardar perfil
                  </button>
                </form>
                <Link
                  href={`${base}/direcciones`}
                  className="mt-6 flex items-center gap-2 font-semibold text-teal-900"
                >
                  <MapPin className="size-4" />
                  Mis direcciones
                </Link>
              </section>
            )}
            {section === "direcciones" && profile && (
              <section className="store-address-layout">
                <div>
                  <h1 className="mb-6 font-display text-3xl font-bold">
                    Mis direcciones
                  </h1>
                  <div className="mb-6 space-y-3">
                    {!profile.addresses.length && (
                      <div className="store-empty-state">
                        <MapPin className="size-8" />
                        <h2>¿Dónde recibirás tu compra?</h2>
                        <p>
                          Guarda tu primera dirección. Podrás elegirla al pagar.
                        </p>
                      </div>
                    )}
                    {profile.addresses.map((address) => (
                      <article key={address.id} className="store-address-card">
                        <h2 className="font-semibold">
                          {address.label}{" "}
                          {address.isDefault && "· Predeterminada"}
                        </h2>
                        <p>
                          {address.street} · {address.district}
                        </p>
                        <p className="text-sm text-stone-500">
                          {address.recipient} · {address.phone}
                        </p>
                        <button
                          className="mt-3 text-sm text-red-700"
                          onClick={() =>
                            void storeApi(
                              slug,
                              `me/addresses/${address.id}`,
                              {},
                              "DELETE",
                            )
                              .then(() => load())
                              .catch((error: Error) =>
                                setMessage(error.message),
                              )
                          }
                        >
                          Eliminar
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
                <form
                  noValidate
                  aria-busy={busy}
                  className="store-form store-form-panel"
                  onSubmit={(event) =>
                    void submit(event, "me/addresses", (data) => ({
                      ...data,
                      isDefault: data.isDefault === "on",
                    }))
                  }
                >
                  <h2 className="store-form-title">Agregar dirección</h2>
                  {field("label", "Nombre de dirección")}
                  {field("recipient", "Destinatario")}
                  {field("phone", "Teléfono", "tel")}
                  {field("street", "Dirección")}
                  {field("district", "Ubigeo del distrito (6 dígitos)")}
                  {field("reference", "Referencia", "text", undefined, false)}
                  <label className="flex gap-2 text-sm">
                    <input type="checkbox" name="isDefault" />
                    Dirección predeterminada
                  </label>
                  <button disabled={busy} className={storeButton}>
                    Agregar dirección
                  </button>
                </form>
              </section>
            )}
            <StoreCommerce
              section={section}
              slug={slug}
              onMessage={setMessage}
              cart={cart}
              onCartChange={setCart}
              currency={info?.currency ?? "PEN"}
              checkoutEnabled={info?.checkoutEnabled !== false}
            />
            {section === "pedidos" && (
              <StoreOrders
                slug={slug}
                id={detailId}
                accountId={profile?.accountId}
                onMessage={setMessage}
              />
            )}
          </>
        )}
      </main>
      <footer className="mx-auto max-w-6xl border-t border-stone-200 px-5 py-7 text-sm text-stone-500">
        Una cuenta de cliente para esta empresa. Tus compras, siempre a mano.
      </footer>
    </div>
  );
}
