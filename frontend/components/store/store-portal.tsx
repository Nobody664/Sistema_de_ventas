"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Package,
  ShoppingBag,
  UserRound,
  MapPin,
  LogOut,
} from "lucide-react";
import { StoreApiError, storeApi } from "@/lib/store-api";
import { StoreCommerce } from "./store-commerce";
import { StoreOrders } from "./store-orders";
import { storeButton, storeInput, storeMoney } from "./store-ui";

export interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  currency: string;
  availability: string;
  baseUnit: string;
  presentations: { id: string; name: string; price: string; factor: string }[];
}
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
  } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
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
  const publicSection = [
    "ingresar",
    "registro",
    "recuperar",
    "verificar",
    "restablecer",
    "privacidad",
  ].includes(section);
  const load = useCallback(async () => {
    try {
      if (!publicSection) {
        const me = await storeApi<Profile>(slug, "me");
        setProfile(me);
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
    setBusy(true);
    setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await storeApi<{ message?: string }>(
        slug,
        path,
        transform ? transform(data) : data,
        method,
      );
      if (path === "auth/login") router.replace(`${base}/catalogo`);
      else {
        setMessage(result.message ?? "Datos guardados");
        await load();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };
  const field = (
    name: string,
    label: string,
    type = "text",
    value?: string,
  ) => (
    <label className="block space-y-1.5 text-sm font-medium text-stone-700">
      {label}
      <input
        className={storeInput}
        name={name}
        type={type}
        defaultValue={value}
        required
        maxLength={type === "password" ? 256 : 240}
        autoComplete={name === "password" ? "current-password" : undefined}
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-stone-900">
      <header className="border-b border-stone-200 bg-white/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <Link href={`${base}/catalogo`} className="flex items-center gap-3">
            <span className="rounded-xl bg-teal-900 p-2.5 text-white">
              <ShoppingBag className="size-5" />
            </span>
            <span className="font-display text-xl font-bold">
              {info?.name ?? "Tu tienda"}
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href={`${base}/catalogo`}>Catálogo</Link>
            <Link href={`${base}/carrito`}>Carrito</Link>
            <Link href={`${base}/pedidos`}>Mis pedidos</Link>
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
      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        {message && (
          <p
            role="status"
            className="mb-6 rounded-xl border border-teal-200 bg-white p-4 text-sm text-teal-950"
          >
            {message}
          </p>
        )}
        {publicSection ? (
          <section className="mx-auto grid max-w-4xl gap-10 md:grid-cols-2">
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
            <div className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
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
                  className="space-y-4"
                  onSubmit={(event) => void submit(event, "auth/login")}
                >
                  {field("email", "Correo", "email")}
                  {field("password", "Contraseña", "password")}
                  <button disabled={busy} className={storeButton}>
                    Ingresar <ArrowRight className="size-4" />
                  </button>
                </form>
              )}
              {section === "registro" && (
                <form
                  className="space-y-4"
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
                  <label className="flex gap-2 text-sm">
                    <input type="checkbox" name="acceptTerms" required />
                    Acepto el registro y tratamiento de mis datos para atender
                    mis compras en esta empresa.
                  </label>
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
                  className="space-y-4"
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
                    className="space-y-4"
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
                    className="mt-6 space-y-4"
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
                  className="space-y-4"
                  onSubmit={(event) =>
                    void submit(event, "auth/reset-password", (data) => ({
                      ...data,
                      token: searchParams.get("token") ?? "",
                    }))
                  }
                >
                  {field("password", "Nueva contraseña", "password")}
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
              <>
                <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-800">
                      Selección de la tienda
                    </p>
                    <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
                      Lo que buscas,
                      <br />a tu alcance.
                    </h1>
                    <p className="mt-4 max-w-lg text-stone-600">
                      {info?.description ??
                        "Descubre los productos que este negocio ha preparado para ti."}
                    </p>
                  </div>
                  <form
                    className="flex w-full gap-2 sm:w-auto"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setPage(1);
                      setQuery(search);
                    }}
                  >
                    <input
                      aria-label="Buscar en catálogo"
                      className={storeInput}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Busca un producto"
                    />
                    <button className={storeButton}>Buscar</button>
                  </form>
                </div>
                {!detailId && (
                  <label className="mb-5 block max-w-sm text-sm">
                    Categoría
                    <select
                      aria-label="Categoría del catálogo"
                      value={categoryId}
                      className={storeInput}
                      onChange={(event) => {
                        setCategoryId(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">Todas las categorías</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {detailId && (
                  <Link
                    href={`${base}/catalogo`}
                    className="mb-5 block text-sm text-teal-900"
                  >
                    ← Volver al catálogo
                  </Link>
                )}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <article
                      key={product.id}
                      className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
                    >
                      <div className="flex aspect-[4/3] items-center justify-center bg-stone-100">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-contain p-5"
                            loading="lazy"
                          />
                        ) : (
                          <Package className="size-16 text-stone-300" />
                        )}
                      </div>
                      <div className="space-y-3 p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                          {product.availability === "AVAILABLE"
                            ? "Disponible"
                            : "Agotado"}
                        </p>
                        <h2 className="font-display text-xl font-bold">
                          <Link href={`${base}/catalogo/${product.id}`}>
                            {product.name}
                          </Link>
                        </h2>
                        <p
                          className={`${detailId ? "" : "line-clamp-2"} min-h-10 text-sm text-stone-500`}
                        >
                          {product.description}
                        </p>
                        <p className="text-xl font-semibold">
                          {storeMoney(product.price, product.currency)}{" "}
                          <span className="text-xs font-normal text-stone-500">
                            / {product.baseUnit}
                          </span>
                        </p>
                        <ProductPurchase
                          product={product}
                          slug={slug}
                          onMessage={setMessage}
                        />
                      </div>
                    </article>
                  ))}
                </div>
                {!products.length && profile && (
                  <p className="py-12 text-center text-stone-500">
                    No hay productos publicados con esta búsqueda.
                  </p>
                )}
                <div className="mt-8 flex justify-center gap-4">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </button>
                  <span>
                    {page} / {Math.max(1, pages)}
                  </span>
                  <button
                    disabled={page >= pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}
            {section === "perfil" && profile && (
              <section className="max-w-xl rounded-3xl border border-stone-200 bg-white p-7">
                <h1 className="mb-6 font-display text-3xl font-bold">
                  Mi perfil
                </h1>
                <p className="mb-5 text-stone-500">{profile.email}</p>
                <form
                  key={JSON.stringify(profile)}
                  className="space-y-4"
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
              <section className="max-w-2xl">
                <h1 className="mb-6 font-display text-3xl font-bold">
                  Mis direcciones
                </h1>
                <div className="mb-6 space-y-3">
                  {profile.addresses.map((address) => (
                    <article
                      key={address.id}
                      className="rounded-2xl border border-stone-200 bg-white p-5"
                    >
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
                            .catch((error: Error) => setMessage(error.message))
                        }
                      >
                        Eliminar
                      </button>
                    </article>
                  ))}
                </div>
                <form
                  className="space-y-4 rounded-3xl bg-white p-6"
                  onSubmit={(event) =>
                    void submit(event, "me/addresses", (data) => ({
                      ...data,
                      isDefault: data.isDefault === "on",
                    }))
                  }
                >
                  {field("label", "Nombre de dirección")}
                  {field("recipient", "Destinatario")}
                  {field("phone", "Teléfono", "tel")}
                  {field("street", "Dirección")}
                  {field("district", "Ubigeo del distrito (6 dígitos)")}
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
            />
            {section === "pedidos" && (
              <StoreOrders slug={slug} id={detailId} onMessage={setMessage} />
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

function ProductPurchase({
  product,
  slug,
  onMessage,
}: {
  product: StoreProduct;
  slug: string;
  onMessage: (text: string) => void;
}) {
  const [presentationId, setPresentation] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <label className="block text-xs text-stone-500">
        Presentación
        <select
          aria-label={`Presentación de ${product.name}`}
          className={storeInput}
          value={presentationId}
          onChange={(event) => setPresentation(event.target.value)}
        >
          <option value="">Unidad base · {storeMoney(product.price)}</option>
          {product.presentations.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {storeMoney(p.price)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <input
          aria-label={`Cantidad de ${product.name}`}
          className={`${storeInput} max-w-24`}
          type="number"
          min={presentationId || product.baseUnit === "UNIT" ? 1 : 0.001}
          step={presentationId || product.baseUnit === "UNIT" ? 1 : 0.001}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
        <button
          disabled={busy || product.availability !== "AVAILABLE"}
          className={storeButton}
          onClick={async () => {
            setBusy(true);
            try {
              const cart = await storeApi<{
                version: number;
                items: { productId: string; quantity: string }[];
              }>(slug, "cart");
              const old = cart.items.find(
                (line) => line.productId === product.id,
              );
              await storeApi(slug, "cart/items", {
                version: cart.version,
                productId: product.id,
                ...(presentationId ? { presentationId } : {}),
                quantity: Number(quantity) + Number(old?.quantity ?? 0),
              });
              onMessage("Producto agregado al carrito");
            } catch (error) {
              onMessage(
                error instanceof Error ? error.message : "No se pudo agregar",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Agregar
        </button>
      </div>
    </div>
  );
}
