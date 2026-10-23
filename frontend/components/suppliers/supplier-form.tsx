"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Tags,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import type { Supplier } from "@/types/suppliers";

export function SupplierForm({ supplier }: { supplier?: Supplier | null }) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!supplier;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const brandsRaw = (formData.get("brands") as string) ?? "";
    const brands = brandsRaw
      .split(",")
      .map((brand) => brand.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      name: (formData.get("name") as string)?.trim(),
      code: (formData.get("code") as string) || undefined,
      contactName: (formData.get("contactName") as string) || undefined,
      email: (formData.get("email") as string) || undefined,
      phone: (formData.get("phone") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
      documentType: (formData.get("documentType") as string) || undefined,
      documentValue: (formData.get("documentValue") as string) || undefined,
      paymentTerms: (formData.get("paymentTerms") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      brands,
    };

    const leadTime = formData.get("leadTimeDays") as string;
    if (leadTime) payload.leadTimeDays = Number(leadTime);

    if (!payload.name) {
      setError("El nombre es obligatorio.");
      setLoading(false);
      return;
    }

    try {
      if (isEdit) {
        await apiFetch(`/suppliers/${supplier!.id}`, {
          method: "PATCH",
          token: getAccessToken(),
          body: JSON.stringify(payload),
        });
        addToast("Proveedor actualizado", "success");
      } else {
        await apiFetch("/suppliers", {
          method: "POST",
          token: getAccessToken(),
          body: JSON.stringify(payload),
        });
        addToast("Proveedor creado", "success");
      }
      router.push("/suppliers");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <button
        onClick={() => router.push("/suppliers")}
        className="flex items-center gap-2 text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a proveedores
      </button>

      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 p-3 shadow-lg shadow-orange-500/20">
          <Truck className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-foreground">
            {isEdit ? "Editar proveedor" : "Nuevo proveedor"}
          </h1>
          <p className="text-sm text-foreground/50">
            {isEdit
              ? "Actualiza los datos del proveedor"
              : "Registra un proveedor para tu empresa"}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        <div className="rounded-2xl border border-foreground/10 bg-card p-6 md:p-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Nombre / Razón social *
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={supplier?.name ?? ""}
                placeholder="Distribuidora Central SAC"
                maxLength={160}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-semibold">
                Código
              </Label>
              <Input
                id="code"
                name="code"
                defaultValue={supplier?.code ?? ""}
                placeholder="PROV-001"
                maxLength={40}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName" className="text-sm font-semibold">
                Contacto
              </Label>
              <Input
                id="contactName"
                name="contactName"
                defaultValue={supplier?.contactName ?? ""}
                placeholder="Nombre del contacto"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentValue" className="text-sm font-semibold">
                Documento (RUC)
              </Label>
              <Input
                id="documentValue"
                name="documentValue"
                defaultValue={supplier?.documentValue ?? ""}
                placeholder="20123456789"
                maxLength={30}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leadTimeDays" className="text-sm font-semibold">
                Tiempo de entrega (días)
              </Label>
              <Input
                id="leadTimeDays"
                name="leadTimeDays"
                type="number"
                min="0"
                defaultValue={supplier?.leadTimeDays ?? ""}
                placeholder="7"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">
                Correo
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={supplier?.email ?? ""}
                  placeholder="ventas@proveedor.com"
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-semibold">
                Teléfono
              </Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={supplier?.phone ?? ""}
                  placeholder="+51 999 999 999"
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address" className="text-sm font-semibold">
                Dirección
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
                <Input
                  id="address"
                  name="address"
                  defaultValue={supplier?.address ?? ""}
                  placeholder="Av. Industrial 123"
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTerms" className="text-sm font-semibold">
                Condiciones de pago
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
                <Input
                  id="paymentTerms"
                  name="paymentTerms"
                  defaultValue={supplier?.paymentTerms ?? ""}
                  placeholder="Crédito 30 días"
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brands" className="text-sm font-semibold">
                Marcas (separadas por coma)
              </Label>
              <div className="relative">
                <Tags className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
                <Input
                  id="brands"
                  name="brands"
                  defaultValue={(supplier?.brands ?? []).join(", ")}
                  placeholder="Coca-Cola, Pepsi"
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes" className="text-sm font-semibold">
                Notas
              </Label>
              <textarea
                id="notes"
                name="notes"
                defaultValue={supplier?.notes ?? ""}
                rows={3}
                placeholder="Observaciones sobre el proveedor..."
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/suppliers")}
            className="h-12 rounded-xl px-6"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-8 font-semibold text-white shadow-lg shadow-orange-500/25"
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </div>
      </form>
    </div>
  );
}
