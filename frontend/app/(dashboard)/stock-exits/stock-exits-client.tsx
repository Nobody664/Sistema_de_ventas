"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import {
  ArrowUpFromLine,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import type {
  Distributor,
  DistributorProductOption,
} from "@/types/distributors";
import type { StockExitMovement } from "./page";

const UNIT_SHORT: Record<string, string> = {
  UNIT: "und",
  KG: "kg",
  LT: "lt",
  MT: "mt",
};

interface Line {
  key: string;
  productId: string;
  quantity: string;
}

interface StockExitsClientProps {
  distributors: Distributor[];
  products: DistributorProductOption[];
  initialExits: StockExitMovement[];
}

const emptyLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  productId: "",
  quantity: "",
});

export function StockExitsClient({
  distributors,
  products,
  initialExits,
}: StockExitsClientProps) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);

  const activeDistributors = useMemo(
    () => distributors.filter((d) => d.status === "ACTIVE"),
    [distributors],
  );
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const [distributorId, setDistributorId] = useState(
    activeDistributors[0]?.id ?? "",
  );
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDistributor = distributors.find((d) => d.id === distributorId);

  const updateLine = (key: string, field: keyof Line, value: string) => {
    setLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, [field]: value } : line,
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!distributorId) {
      setError("Selecciona un distribuidor.");
      return;
    }

    const items = lines
      .filter((line) => line.productId && Number(line.quantity) > 0)
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
      }));

    if (items.length === 0) {
      setError("Agrega al menos un producto con cantidad mayor a 0.");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/stock-exits", {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({
          distributorId,
          items,
          notes: notes || undefined,
        }),
      });

      addToast("Salida a distribuidor registrada correctamente", "success");
      setLines([emptyLine()]);
      setNotes("");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo registrar la salida.";
      setError(message);
      addToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-100">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">
                Distribuidor
              </Label>
              <select
                value={distributorId}
                onChange={(event) => setDistributorId(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              >
                <option value="">Selecciona un distribuidor</option>
                {activeDistributors.map((distributor) => (
                  <option key={distributor.id} value={distributor.id}>
                    {distributor.name} ({distributor.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">
                Notas
              </Label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observaciones"
                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>
          </div>

          {selectedDistributor && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-sm text-orange-700">
              Mercadería consignada:{" "}
              <span className="font-semibold">
                {Number(selectedDistributor.balance?.balanceQuantity ?? 0)}
              </span>{" "}
              · Deuda:{" "}
              <span className="font-semibold">
                S/{" "}
                {Number(selectedDistributor.balance?.debtAmount ?? 0).toFixed(
                  2,
                )}
              </span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Productos
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-orange-300"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar línea
              </Button>
            </div>

            {lines.map((line) => {
              const product = productMap.get(line.productId);
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:grid-cols-12"
                >
                  <div className="space-y-1 sm:col-span-7">
                    <Label className="text-xs font-semibold text-slate-500">
                      Producto
                    </Label>
                    <select
                      value={line.productId}
                      onChange={(event) =>
                        updateLine(line.key, "productId", event.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">Selecciona un producto</option>
                      {products.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} (stock {Number(option.stockQuantity)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-4">
                    <Label className="text-xs font-semibold text-slate-500">
                      Cantidad
                    </Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, "quantity", event.target.value)
                      }
                      placeholder="0"
                      className="h-11 rounded-lg border-slate-200 bg-white"
                    />
                  </div>

                  <div className="flex items-end justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setLines((prev) =>
                          prev.length > 1
                            ? prev.filter((l) => l.key !== line.key)
                            : prev,
                        )
                      }
                      disabled={lines.length === 1}
                      className="h-11 w-11 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Eliminar línea"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {product && (
                    <p className="text-xs text-slate-400 sm:col-span-12">
                      Unidad base:{" "}
                      {UNIT_SHORT[product.baseUnit] ?? product.baseUnit}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button
              type="submit"
              disabled={submitting}
              className="h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-8 font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-600 hover:to-amber-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                  Registrar salida
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
            Historial
          </p>
          <h2 className="mt-2 font-display text-2xl">Salidas registradas</h2>
        </div>

        <div className="max-h-[600px] overflow-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[720px]">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                <th className="pb-4 pl-4 font-medium">Fecha</th>
                <th className="pb-4 font-medium">Distribuidor</th>
                <th className="pb-4 font-medium">Producto</th>
                <th className="pb-4 text-right font-medium">Cantidad</th>
                <th className="pb-4 pr-4 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody>
              {initialExits.length > 0 ? (
                initialExits.map((exit) => (
                  <tr
                    key={exit.id}
                    className="border-b border-foreground/5 table-row-hover"
                  >
                    <td className="py-3 pl-4 text-sm text-foreground/60">
                      {new Date(exit.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-sm font-medium">
                      {exit.distributor ? (
                        <Link
                          href={`/distributors/${exit.distributor.id}`}
                          className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-700"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          {exit.distributor.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 text-sm">
                      {exit.product.name}
                      <span className="block text-xs text-slate-400">
                        {UNIT_SHORT[exit.product.baseUnit] ??
                          exit.product.baseUnit}
                      </span>
                    </td>
                    <td className="py-3 text-right text-sm font-medium">
                      {Math.abs(Number(exit.quantity))}
                    </td>
                    <td className="py-3 pr-4 text-sm text-foreground/60">
                      {exit.notes ?? "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-foreground/50"
                  >
                    Aún no hay salidas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
