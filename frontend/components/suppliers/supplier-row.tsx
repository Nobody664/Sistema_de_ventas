"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Mail, Phone, Trash2 } from "lucide-react";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { usePermissions } from "@/hooks/usePermissions";
import type { Supplier } from "@/types/suppliers";

export function SupplierRow({ supplier }: { supplier: Supplier }) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const { hasPermission } = usePermissions();
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (!window.confirm(`¿Eliminar el proveedor "${supplier.name}"?`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/suppliers/${supplier.id}`, {
        method: "DELETE",
        token: getAccessToken(),
      });
      addToast("Proveedor eliminado", "success");
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 py-4 sm:px-3">
      <Link
        href={`/suppliers/${supplier.id}`}
        className="min-w-0 flex-1 transition hover:opacity-80"
      >
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-medium truncate">{supplier.name}</p>
          {supplier.code && (
            <span className="shrink-0 rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-600">
              {supplier.code}
            </span>
          )}
          {!supplier.isActive && (
            <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-foreground/50">
              Inactivo
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-foreground/50">
          {supplier.email && (
            <span className="flex items-center gap-1 min-w-0">
              <Mail className="size-3 shrink-0" />
              <span className="truncate">{supplier.email}</span>
            </span>
          )}
          {supplier.phone && (
            <span className="flex items-center gap-1">
              <Phone className="size-3 shrink-0" />
              {supplier.phone}
            </span>
          )}
          <span>{supplier.products.length} productos</span>
        </div>
      </Link>
      {hasPermission("supplier:delete") && (
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="shrink-0 rounded-xl p-2 text-foreground/40 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}
