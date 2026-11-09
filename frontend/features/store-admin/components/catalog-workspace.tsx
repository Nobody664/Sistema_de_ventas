"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAdminQuery, useAdminWrite } from "../api/queries";
import { useCommerceContext } from "./commerce-shell";
import {
  commerceButton,
  commerceInput,
  Heading,
  Panel,
  QueryState,
  Money,
} from "./commerce-ui";

interface CatalogPage {
  data: Array<{
    id: string;
    name: string;
    sku: string | null;
    imageUrl: string | null;
    salePrice: string;
    storeVisible: boolean;
    isActive: boolean;
    category: { id: string; name: string } | null;
  }>;
  total: number;
  page: number;
  limit: number;
  categories: Array<{ id: string; name: string }>;
}

export function CatalogWorkspace() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { context } = useCommerceContext();
  const params = new URLSearchParams({ limit: "24" });
  for (const key of ["q", "categoryId", "publication", "activity", "page"]) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  const query = useAdminQuery<CatalogPage>(`catalog?${params}`);
  const write = useAdminWrite<{ updated: boolean }>();
  const gallery = search.get("view") !== "list";
  const navigate = (key: string, value: string) => {
    const next = new URLSearchParams(search.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next}`);
  };
  return (
    <div className="space-y-6">
      <Heading
        title="Catálogo"
        description="Decide qué productos publicar. Los precios, el stock y el estado activo pertenecen a Gestión de ventas y no se modifican aquí."
      />
      <Panel>
        <form
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          key={search.toString()}
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams();
            for (const [key, value] of new FormData(event.currentTarget))
              if (String(value).trim()) next.set(key, String(value).trim());
            if (!gallery) next.set("view", "list");
            router.replace(`${pathname}?${next}`);
          }}
        >
          <label className="text-xs font-semibold">
            Buscar producto
            <input
              name="q"
              maxLength={80}
              defaultValue={search.get("q") ?? ""}
              className={`${commerceInput} mt-2`}
              placeholder="Nombre o SKU"
            />
          </label>
          <label className="text-xs font-semibold">
            Categoría
            <select
              name="categoryId"
              aria-label="Categoría"
              defaultValue={search.get("categoryId") ?? ""}
              className={`${commerceInput} mt-2`}
            >
              <option value="">Todas las categorías</option>
              {query.data?.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Publicación
            <select
              name="publication"
              aria-label="Publicación"
              defaultValue={search.get("publication") ?? ""}
              className={`${commerceInput} mt-2`}
            >
              <option value="">Todos los productos</option>
              <option value="published">Publicados</option>
              <option value="hidden">Sin publicar</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Estado del producto
            <select
              name="activity"
              aria-label="Estado del producto"
              defaultValue={search.get("activity") ?? ""}
              className={`${commerceInput} mt-2`}
            >
              <option value="">Activos e inactivos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </label>
          <button className={commerceButton}>Buscar productos</button>
        </form>
      </Panel>
      <div className="flex flex-wrap justify-between gap-3">
        <p className="text-sm text-foreground/55">
          {query.data?.total ?? "—"} productos
        </p>
        <div className="flex gap-2">
          <button
            className={commerceButton}
            aria-pressed={gallery}
            onClick={() => navigate("view", "gallery")}
          >
            Galería
          </button>
          <button
            className={commerceButton}
            aria-pressed={!gallery}
            onClick={() => navigate("view", "list")}
          >
            Lista
          </button>
        </div>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {write.error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/40 p-4 text-sm"
        >
          {write.error.message}
        </p>
      )}
      {query.data?.data.length === 0 && (
        <Panel>
          <p>No hay productos con estos filtros.</p>
        </Panel>
      )}
      <div
        className={
          gallery ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"
        }
      >
        {query.data?.data.map((product) => (
          <Panel
            key={product.id}
            className={
              gallery ? "" : "flex flex-wrap items-center justify-between gap-5"
            }
          >
            {product.imageUrl && (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={640}
                height={400}
                unoptimized
                className={
                  gallery
                    ? "mb-4 h-40 w-full rounded-xl object-contain"
                    : "h-16 w-20 rounded-xl object-contain"
                }
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground/45">
                {product.category?.name ?? "Sin categoría"} ·{" "}
                {product.sku ?? "Sin SKU"}
              </p>
              <h2 className="mt-2 break-words font-display text-xl font-semibold">
                {product.name}
              </h2>
              <p className="mt-3">
                <Money value={product.salePrice} />
              </p>
              <p className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-foreground/5 px-3 py-1">
                  {product.isActive ? "Producto activo" : "Producto inactivo"}
                </span>
                <span className="rounded-full bg-primary/10 px-3 py-1">
                  {product.storeVisible ? "Publicado" : "Sin publicar"}
                </span>
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                disabled={write.isPending}
                aria-label={`${product.storeVisible ? "Ocultar" : "Publicar"} ${product.name}`}
                className={commerceButton}
                onClick={() =>
                  void write
                    .mutateAsync({
                      resource: `products/${product.id}`,
                      body: { visible: !product.storeVisible },
                    })
                    .catch(() => undefined)
                }
              >
                {product.storeVisible
                  ? "Ocultar de la tienda"
                  : "Publicar en tienda"}
              </button>
              {product.storeVisible && product.isActive && (
                <a
                  href={`/tienda/${context.store.slug}/catalogo/${product.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary"
                >
                  Vista del cliente ↗
                </a>
              )}
              <Link
                href={`/products/${product.id}`}
                className="text-xs text-foreground/55 underline"
              >
                Ver producto fuente
              </Link>
            </div>
            {!product.isActive && product.storeVisible && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                No aparece en el catálogo público mientras esté inactivo.
              </p>
            )}
          </Panel>
        ))}
      </div>
      {query.data && (
        <div className="flex items-center justify-between gap-3">
          <button
            className={commerceButton}
            disabled={query.data.page <= 1}
            onClick={() => navigate("page", String(query.data!.page - 1))}
          >
            Anterior
          </button>
          <span className="text-xs">
            Página {query.data.page} · {query.data.total} productos
          </span>
          <button
            className={commerceButton}
            disabled={query.data.page * query.data.limit >= query.data.total}
            onClick={() => navigate("page", String(query.data!.page + 1))}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
