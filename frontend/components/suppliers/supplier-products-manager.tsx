"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import type { Supplier } from "@/types/suppliers";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  baseUnit: string;
}

interface RowState {
  selected: boolean;
  isPreferred: boolean;
  minOrderQuantity: number;
}

export function SupplierProductsManager({
  supplier,
  productOptions,
}: {
  supplier: Supplier;
  productOptions: ProductOption[];
}) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const initial = useMemo(() => {
    const map = new Map<string, RowState>();
    for (const link of supplier.products) {
      map.set(link.productId, {
        selected: true,
        isPreferred: link.isPreferred,
        minOrderQuantity: Number(link.minOrderQuantity),
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.id]);

  const [rows, setRows] = useState<Map<string, RowState>>(initial);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productOptions;
    return productOptions.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        (product.sku ?? "").toLowerCase().includes(q),
    );
  }, [productOptions, query]);

  const toggle = (productId: string) => {
    setRows((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) ?? {
        selected: false,
        isPreferred: false,
        minOrderQuantity: 1,
      };
      if (current.selected) {
        next.delete(productId);
      } else {
        next.set(productId, {
          selected: true,
          isPreferred: current.isPreferred,
          minOrderQuantity: current.minOrderQuantity || 1,
        });
      }
      return next;
    });
  };

  const setPreferred = (productId: string) => {
    setRows((prev) => {
      const next = new Map(prev);
      const current = next.get(productId);
      if (!current?.selected) return prev;
      for (const [key, value] of next) {
        next.set(key, { ...value, isPreferred: key === productId });
      }
      return next;
    });
  };

  const setMinQty = (productId: string, value: number) => {
    setRows((prev) => {
      const next = new Map(prev);
      const current = next.get(productId);
      if (!current?.selected) return prev;
      next.set(productId, { ...current, minOrderQuantity: value });
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const items = Array.from(rows.entries()).map(([productId, state]) => ({
        productId,
        isPreferred: state.isPreferred,
        minOrderQuantity: state.minOrderQuantity,
      }));
      await apiFetch(`/suppliers/${supplier.id}/products`, {
        method: "PUT",
        token: getAccessToken(),
        body: JSON.stringify({ items }),
      });
      addToast("Productos actualizados", "success");
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = rows.size;

  return (
    <Card className="space-y-4 rounded-[30px] bg-white/85 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-orange-600" />
          <p className="font-display text-lg">
            Productos asignados ({selectedCount})
          </p>
        </div>
        <Button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-5 font-semibold text-white"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Guardar
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto por nombre o SKU..."
          className="h-11 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
        />
      </div>

      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {filtered.map((product) => {
          const state = rows.get(product.id);
          const selected = !!state?.selected;
          return (
            <div
              key={product.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm ${
                selected
                  ? "border-orange-300 bg-orange-50/50"
                  : "border-foreground/10"
              }`}
            >
              <label className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(product.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {product.name}
                  </span>
                  <span className="block text-xs text-foreground/50">
                    {product.sku ?? "Sin SKU"} · {product.baseUnit}
                  </span>
                </span>
              </label>
              {selected && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreferred(product.id)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      state?.isPreferred
                        ? "bg-amber-500/20 text-amber-600"
                        : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10"
                    }`}
                  >
                    <Star className="size-3.5" />
                    {state?.isPreferred ? "Preferido" : "Preferir"}
                  </button>
                  <label className="flex items-center gap-1 text-xs text-foreground/50">
                    Mín.
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={state?.minOrderQuantity ?? 1}
                      onChange={(e) =>
                        setMinQty(product.id, Number(e.target.value))
                      }
                      className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-xs"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-foreground/50">
            No se encontraron productos.
          </p>
        )}
      </div>
    </Card>
  );
}
