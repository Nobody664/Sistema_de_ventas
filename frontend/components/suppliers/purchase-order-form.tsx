"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  purchaseOrderPayload,
  type PurchaseOrderDraftItem,
} from "@/lib/purchase-order";
import { quantityStep } from "@/lib/sale-quantity";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui-store";
import type { Product } from "@/types/api";
import type { ProductCatalog } from "@/types/products";
import type { Supplier, SupplierOrder } from "@/types/suppliers";

const field =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";

export function PurchaseOrderForm({
  suppliers,
  initialCatalog,
}: {
  suppliers: Supplier[];
  initialCatalog: ProductCatalog;
}) {
  const router = useRouter();
  const cache = useQueryClient();
  const toast = useUiStore((state) => state.addToast);
  const submitting = useRef(false);
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<PurchaseOrderDraftItem[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const products = useQuery({
    queryKey: ["products", "order-picker", { search, page }],
    queryFn: ({ signal }) =>
      apiFetch<ProductCatalog>(
        `/products/catalog?${new URLSearchParams({ isActive: "true", limit: "20", page: String(page), search })}`,
        { signal },
      ),
    initialData: !search && page === 1 ? initialCatalog : undefined,
    enabled: !!supplierId,
  });
  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === supplierId,
  );
  const addProduct = (product: Product) => {
    if (rows.some((row) => row.productId === product.id) || rows.length >= 100)
      return;
    const link = selectedSupplier?.products?.find(
      (item) => item.productId === product.id,
    );
    const cost = link?.lastCost ?? product.costPrice;
    setRows((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        baseUnit: product.baseUnit,
        quantity: "1",
        unitCost: cost == null ? "" : String(cost),
      },
    ]);
    setError(null);
  };
  const updateRow = (id: string, key: "quantity" | "unitCost", value: string) =>
    setRows((current) =>
      current.map((row) =>
        row.productId === id ? { ...row, [key]: value } : row,
      ),
    );
  const quoted =
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.unitCost.trim() !== "" &&
        row.quantity.trim() !== "" &&
        Number.isFinite(Number(row.unitCost)) &&
        Number.isFinite(Number(row.quantity)),
    );
  const estimated = rows.reduce(
    (sum, row) => sum + Number(row.quantity) * Number(row.unitCost),
    0,
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    let body: ReturnType<typeof purchaseOrderPayload>;
    try {
      body = purchaseOrderPayload(supplierId, reference, notes, rows);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Revisa el detalle de la orden",
      );
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const order = await apiFetch<SupplierOrder>("/suppliers/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await cache.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast("Orden de compra creada como borrador", "success");
      router.push(`/purchase-orders/${order.id}`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo crear la orden",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  if (!suppliers.length)
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="font-semibold">Primero registra un proveedor activo</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La orden debe pertenecer a un proveedor de tu negocio.
        </p>
        <Button asChild className="mt-4">
          <Link href="/suppliers/new">Registrar proveedor</Link>
        </Button>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset
        disabled={saving}
        className="grid gap-5 rounded-2xl border bg-card p-5 sm:grid-cols-2 sm:p-6"
      >
        <label className="space-y-2 text-sm font-medium">
          <span>Proveedor</span>
          <select
            aria-label="Proveedor"
            aria-describedby="purchase-supplier-help"
            required
            value={supplierId}
            onChange={(event) => {
              setSupplierId(event.target.value);
              setRows([]);
              setError(null);
            }}
            className={field}
          >
            <option value="">Selecciona un proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <span
            id="purchase-supplier-help"
            className="block text-xs font-normal text-muted-foreground"
          >
            Al cambiar proveedor se limpia el detalle del pedido.
          </span>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>Referencia</span>
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={60}
            placeholder="Ej. OC-2026-001"
            className={field}
          />
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          <span>Notas para la orden</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            rows={2}
            className={field}
          />
        </label>
      </fieldset>

      <section
        className="rounded-2xl border bg-card p-5 sm:p-6"
        aria-labelledby="order-products-title"
      >
        <h2
          id="order-products-title"
          className="font-display text-xl font-semibold"
        >
          Agregar productos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cantidades en la unidad base del producto. Puedes pedir mercadería
          aunque su stock actual sea cero.
        </p>
        {!supplierId ? (
          <p className="mt-5 rounded-xl bg-muted p-4 text-sm">
            Selecciona un proveedor para preparar el detalle.
          </p>
        ) : (
          <>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                aria-label="Buscar productos para la orden"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Nombre, SKU o código de barras"
                className={`${field} pl-10`}
                disabled={saving}
              />
            </div>
            {products.error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                No se pudieron cargar los productos.{" "}
                <button
                  type="button"
                  onClick={() => void products.refetch()}
                  className="underline"
                >
                  Reintentar
                </button>
              </p>
            )}
            <div className="mt-3 max-h-64 divide-y overflow-auto">
              {products.isPending || query.trim() !== search ? (
                <p className="py-6 text-sm text-muted-foreground">
                  Buscando productos...
                </p>
              ) : products.data?.data.length ? (
                products.data.data.map((product) => {
                  const selected = rows.some(
                    (row) => row.productId === product.id,
                  );
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku ?? "Sin SKU"} · Unidad:{" "}
                          {product.baseUnit} · Stock:{" "}
                          {Number(product.stockQuantity)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving || selected || rows.length >= 100}
                        aria-label={`Agregar ${product.name}`}
                        onClick={() => addProduct(product)}
                      >
                        {selected ? (
                          "Agregado"
                        ) : (
                          <>
                            <Plus className="size-3.5" />
                            Agregar
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              ) : (
                !products.error && (
                  <p className="py-6 text-sm text-muted-foreground">
                    No hay productos activos que coincidan.{" "}
                    <Link href="/products/new" className="underline">
                      Registrar producto
                    </Link>
                  </p>
                )
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {products.data?.total ?? 0} productos · Página {page}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || products.isFetching || saving}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    page >= (products.data?.totalPages ?? 0) ||
                    products.isFetching ||
                    saving
                  }
                  onClick={() => setPage((value) => value + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <section
        className="rounded-2xl border bg-card p-5 sm:p-6"
        aria-labelledby="order-detail-title"
      >
        <h2
          id="order-detail-title"
          className="font-display text-xl font-semibold"
        >
          Detalle del pedido{" "}
          <span className="text-muted-foreground">({rows.length}/100)</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El costo es opcional al crear el borrador; debes confirmarlo antes de
          recibir. Un costo cero significa una adquisición sin cargo.
        </p>
        {!rows.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Agrega al menos un producto para crear la orden.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <div
                key={row.productId}
                className="grid items-end gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_130px_150px_auto]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{row.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unidad base: {row.baseUnit}
                  </p>
                </div>
                <label className="space-y-1 text-xs">
                  <span>Cantidad</span>
                  <input
                    aria-label={`Cantidad de ${row.name}`}
                    type="number"
                    required
                    min={quantityStep(row.baseUnit)}
                    max="99999999999.999"
                    step={quantityStep(row.baseUnit)}
                    value={row.quantity}
                    disabled={saving}
                    onChange={(event) =>
                      updateRow(row.productId, "quantity", event.target.value)
                    }
                    className={field}
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span>Costo unitario (S/)</span>
                  <input
                    aria-label={`Costo de ${row.name}`}
                    type="number"
                    min="0"
                    max="99999999.9999"
                    step="0.0001"
                    value={row.unitCost}
                    placeholder="Por cotizar"
                    disabled={saving}
                    onChange={(event) =>
                      updateRow(row.productId, "unitCost", event.target.value)
                    }
                    className={field}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Quitar ${row.name}`}
                  disabled={saving}
                  onClick={() =>
                    setRows((current) =>
                      current.filter(
                        (item) => item.productId !== row.productId,
                      ),
                    )
                  }
                  className="px-3 text-red-600"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
          <div>
            <p className="text-sm text-muted-foreground">Total estimado</p>
            <p className="mt-1 font-display text-2xl font-semibold">
              {quoted ? `S/ ${estimated.toFixed(2)}` : "Por cotizar"}
            </p>
          </div>
          <Button
            type="submit"
            disabled={saving || !rows.length || !supplierId}
            className="rounded-xl"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}Crear orden
            de compra
          </Button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-500/30 p-3 text-sm text-red-600"
          >
            {error}
          </p>
        )}
      </section>
    </form>
  );
}
