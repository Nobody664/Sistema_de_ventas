"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Sparkles, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { usePermissions } from "@/hooks/usePermissions";
import type { AutoOrdersPreview, SupplierOrder } from "@/types/suppliers";

export function AutoOrdersPanel({ preview }: { preview: AutoOrdersPreview }) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const { hasPermission } = usePermissions();
  const [generating, setGenerating] = useState(false);

  const canManage = hasPermission("supplier_order:manage");
  const totalItems = preview.groups.reduce(
    (acc, group) => acc + group.items.length,
    0,
  );

  const generate = async () => {
    setGenerating(true);
    try {
      const orders = await apiFetch<SupplierOrder[]>(
        "/suppliers/auto-orders/generate",
        {
          method: "POST",
          token: getAccessToken(),
        },
      );
      addToast(`${orders.length} órdenes borrador generadas`, "success");
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-150">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-orange-600" />
          <p className="font-display text-lg">Sugerencias automáticas</p>
        </div>
        {canManage && totalItems > 0 && (
          <Button
            type="button"
            onClick={generate}
            disabled={generating}
            className="h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-5 font-semibold text-white"
          >
            {generating ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <PackagePlus className="mr-2 size-4" />
            )}
            Generar borradores
          </Button>
        )}
      </div>

      {totalItems === 0 ? (
        <p className="mt-4 text-sm text-foreground/50">
          No hay productos con stock bajo asignados a un proveedor.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {preview.groups.map((group) => (
            <div
              key={group.supplier.id}
              className="rounded-2xl border border-foreground/10 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{group.supplier.name}</p>
                <span className="text-sm text-foreground/50">
                  {group.items.some((item) => item.estimatedCost === null)
                    ? "Por cotizar"
                    : `S/ ${group.estimatedTotal.toFixed(2)}`}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {group.items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 truncate text-foreground/70">
                      {item.productName}
                    </span>
                    <span className="shrink-0 text-foreground/50">
                      {item.currentStock} → {item.suggestedQuantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview.unassigned.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              {preview.unassigned.length} productos sin proveedor asignado
            </p>
            <p className="mt-1 text-amber-700/80">
              {preview.unassigned.map((item) => item.productName).join(", ")}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
