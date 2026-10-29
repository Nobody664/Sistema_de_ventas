"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  Package,
  AlertTriangle,
  TrendingUp,
  Search,
  Download,
} from "lucide-react";
import {
  ProductActions,
  NewProductButton,
} from "@/components/products/product-actions";
import { ImageLightbox } from "@/components/products/image-lightbox";
import { apiFetch, getAccessToken } from "@/lib/api";
import type { Category } from "@/types/api";
import type { ProductCatalog } from "@/types/products";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { useUiStore } from "@/store/ui-store";
import { useCompanyFormat } from "@/components/settings/company-settings-provider";

const UNIT_SHORT: Record<string, string> = {
  UNIT: "und",
  KG: "kg",
  LT: "lt",
  MT: "mt",
};

function ExpiryBadge({ value }: { value?: Date | string | null }) {
  if (!value) {
    return <span className="text-foreground/30">—</span>;
  }

  const date = new Date(value);
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const label =
    daysLeft < 0 ? "Vencido" : daysLeft <= 3 ? "Por vencer" : "Vigente";
  const className =
    daysLeft < 0
      ? "border-red-500/30 bg-red-500/15 text-red-700"
      : daysLeft <= 3
        ? "border-amber-500/30 bg-amber-500/20 text-amber-700"
        : "border-emerald-500/30 bg-emerald-500/15 text-emerald-700";

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm text-foreground/70">
        {date.toLocaleDateString("es-PE")}
      </span>
      <span
        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
      >
        {label}
      </span>
    </div>
  );
}

interface ProductsPageClientProps {
  initialCatalog: ProductCatalog;
  categories: Category[];
}

export function ProductsPageClient({
  initialCatalog,
  categories,
}: ProductsPageClientProps) {
  const format = useCompanyFormat();
  const addToast = useUiStore((state) => state.addToast);
  const [searchQuery, setSearchQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);
  const {
    data: catalog,
    isPending,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "products",
      "catalog",
      { page, categoryId: selectedCategory, search, limit: 50 },
    ],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (search) params.set("search", search);
      return apiFetch<ProductCatalog>(`/products/catalog?${params}`, {
        token: getAccessToken(),
        signal,
      });
    },
    initialData:
      page === 1 && !selectedCategory && !search ? initialCatalog : undefined,
  });
  useEffect(() => {
    if (catalog && page > Math.max(1, catalog.totalPages))
      setPage(Math.max(1, catalog.totalPages));
  }, [catalog, page]);
  const products = catalog?.data ?? [];
  const busy = isPending || searchQuery.trim() !== search;
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const lowStockProducts = products.filter(
    (p) => Number(p.stockQuantity) <= Number(p.minStock ?? 0),
  );
  const totalValue = products.reduce(
    (acc, p) => acc + Number(p.salePrice) * Number(p.stockQuantity),
    0,
  );

  const filteredProducts = products;

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    try {
      const params = new URLSearchParams({ format });
      if (selectedCategory) params.append("categoryId", selectedCategory);

      const response = await apiFetch<{
        data: string;
        contentType: string;
        filename: string;
      }>(`/products/export?${params}`, {
        token: getAccessToken(),
      });

      if (response?.data) {
        const link = document.createElement("a");
        link.href = `data:${response.contentType};base64,${response.data}`;
        link.download = response.filename;
        link.click();
      }
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "No se pudo exportar el catálogo",
        "error",
      );
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-700 p-6 sm:p-8 text-white animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.18em] text-white/60">
                Catalogo de productos
              </p>
              <h1 className="mt-4 font-display text-4xl leading-tight break-words sm:text-5xl sm:leading-none">
                Gestion de inventario
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
                Administra tu catalogo de productos, controla el stock y mantien
                actualizado tu inventario.
              </p>
            </div>
            <div className="hidden lg:block animate-fade-in-up delay-200">
              <NewProductButton />
            </div>
          </div>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-100">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-500/20 p-2">
                <Package className="size-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                  Productos encontrados
                </p>
                <p className="font-display text-3xl">{catalog?.total ?? "—"}</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-150">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/20 p-2">
                <AlertTriangle className="size-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                  Stock bajo · página
                </p>
                <p className="font-display text-3xl">
                  {lowStockProducts.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-200">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/20 p-2">
                <TrendingUp className="size-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                  Valor de venta · página
                </p>
                <p className="font-display text-3xl break-words">
                  S/ {totalValue.toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-250">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Productos
              </p>
              <h2 className="mt-2 font-display text-2xl">
                Catálogo de productos
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
                <input
                  aria-label="Buscar productos"
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-foreground/10 bg-white py-2 pl-9 pr-4 text-sm transition focus:border-emerald-500/50 focus:outline-none sm:w-auto"
                />
              </div>
              <select
                aria-label="Filtrar por categoría"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-foreground/10 bg-white px-4 py-2 text-sm transition focus:border-emerald-500/50 focus:outline-none sm:w-auto"
              >
                <option value="">Todas las categorias</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <PermissionGuard permission="product:export">
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-foreground/10 bg-white px-4 py-2 text-sm transition hover:bg-foreground/5 [&::-webkit-details-marker]:hidden">
                    <Download className="size-4" />
                    Exportar
                  </summary>
                  <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-xl border border-foreground/10 bg-white py-1 shadow-lg">
                    <button
                      onClick={() => handleExport("csv")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5"
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => handleExport("excel")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5"
                    >
                      Excel
                    </button>
                    <button
                      onClick={() => handleExport("pdf")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5"
                    >
                      PDF
                    </button>
                  </div>
                </details>
              </PermissionGuard>
              <div className="lg:hidden">
                <NewProductButton />
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-500/30 p-4 text-sm"
            >
              No se pudo actualizar el catálogo. {error.message}
              <button
                onClick={() => void refetch()}
                disabled={isFetching}
                className="ml-2 underline"
              >
                Reintentar
              </button>
            </div>
          )}

          <div className="overflow-auto max-h-[600px] rounded-xl border border-foreground/10">
            <table className="w-full min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                  <th className="pb-4 pl-4 font-medium">Imagen</th>
                  <th className="pb-4 font-medium">Producto</th>
                  <th className="pb-4 font-medium">SKU</th>
                  <th className="pb-4 font-medium">Categoria</th>
                  <th className="pb-4 font-medium text-right">Stock</th>
                  <th className="pb-4 font-medium text-right">Precio</th>
                  <th className="pb-4 font-medium text-center">Registro</th>
                  <th className="pb-4 font-medium text-center">Vencimiento</th>
                  <th className="pb-4 font-medium text-center">Estado</th>
                  <th className="pb-4 pr-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {busy ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-12 text-center text-muted-foreground"
                    >
                      Cargando productos...
                    </td>
                  </tr>
                ) : filteredProducts.length > 0 ? (
                  filteredProducts.map((product, index) => (
                    <tr
                      key={product.id}
                      className="border-b border-foreground/5 table-row-hover animate-fade-in-up"
                      style={{ animationDelay: `${index * 30}ms`, opacity: 0 }}
                    >
                      <td className="py-4 pl-4">
                        {product.imageUrl ? (
                          <button
                            onClick={() =>
                              setLightboxImage({
                                src: product.imageUrl!,
                                alt: product.name,
                              })
                            }
                            className="group relative block overflow-hidden rounded-lg"
                          >
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-12 w-12 rounded-lg object-cover img-zoom"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                              <span className="opacity-0 transition-opacity group-hover:opacity-100 text-white text-xs">
                                Ver
                              </span>
                            </div>
                          </button>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/5">
                            <Package className="size-5 text-foreground/30" />
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-foreground/40 truncate max-w-[200px]">
                            {product.description}
                          </p>
                        )}
                      </td>
                      <td className="py-4">
                        <span className="font-mono text-sm text-foreground/60">
                          {product.sku}
                        </span>
                      </td>
                      <td className="py-4">
                        {product.category ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            {product.category.name}
                          </span>
                        ) : (
                          <span className="text-foreground/40">-</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <span
                          className={`inline-block font-medium ${
                            Number(product.stockQuantity) === 0
                              ? "text-red-600"
                              : Number(product.stockQuantity) <=
                                  Number(product.minStock ?? 0)
                                ? "text-amber-600"
                                : "text-foreground"
                          }`}
                        >
                          {Number(product.stockQuantity)}{" "}
                          {UNIT_SHORT[product.baseUnit] ?? product.baseUnit}
                        </span>
                        {Number(product.stockQuantity) <=
                          Number(product.minStock ?? 0) && (
                          <AlertTriangle className="ml-1 inline-block size-3 text-amber-500" />
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <span className="font-medium">
                          S/ {Number(product.salePrice).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 text-center text-sm text-foreground/60">
                        {format.date(product.createdAt)}
                      </td>
                      <td className="py-4 text-center">
                        <ExpiryBadge value={product.expiryDate} />
                      </td>
                      <td className="py-4 text-center">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                            product.isActive
                              ? "border-green-500/30 bg-green-500/20 text-green-700"
                              : "border-gray-500/30 bg-gray-500/20 text-gray-600"
                          }`}
                        >
                          {product.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <ProductActions product={product} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-12 text-center text-foreground/50"
                    >
                      {error
                        ? "El catálogo no está disponible. Reintenta la consulta."
                        : searchQuery || selectedCategory
                          ? "No se encontraron productos con los filtros aplicados."
                          : "No hay productos registrados. Registra el Primero!!."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {catalog?.total ?? 0} resultados · Página {page} de{" "}
              {Math.max(1, catalog?.totalPages ?? 0)}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                disabled={isFetching || page >= (catalog?.totalPages ?? 0)}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </Card>
      </div>

      <ImageLightbox
        src={lightboxImage?.src || ""}
        alt={lightboxImage?.alt || ""}
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </>
  );
}
