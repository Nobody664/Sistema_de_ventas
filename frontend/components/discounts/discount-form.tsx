"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch, getAccessToken } from "@/lib/api";
import { handleLimitError } from "@/lib/handle-limit-error";
import { useUiStore } from "@/store/ui-store";
import { createDiscountCouponSchema } from "@/lib/validations/discount.validation";
import type { DiscountCoupon } from "@/types/api";

interface DiscountFormProps {
  coupon?: DiscountCoupon | null;
}

const fieldClass =
  "h-12 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all";

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function DiscountForm({ coupon }: DiscountFormProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [type, setType] = useState<"PERCENTAGE" | "FIXED">(
    coupon?.type ?? "PERCENTAGE",
  );
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);

  const isEdit = !!coupon;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const rawValue = ((formData.get("value") as string) ?? "").trim();
    const rawMaxUses = ((formData.get("maxUses") as string) ?? "").trim();
    const rawMinPurchase = (
      (formData.get("minPurchase") as string) ?? ""
    ).trim();

    const result = createDiscountCouponSchema.safeParse({
      code: ((formData.get("code") as string) ?? "").trim().toUpperCase(),
      description: ((formData.get("description") as string) ?? "").trim(),
      type,
      value: rawValue === "" ? undefined : rawValue,
      maxUses: rawMaxUses === "" ? null : rawMaxUses,
      minPurchase: rawMinPurchase === "" ? null : rawMinPurchase,
      startsAt: (formData.get("startsAt") as string) ?? "",
      expiresAt: (formData.get("expiresAt") as string) ?? "",
      isActive,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field) {
          errors[field as string] = issue.message;
        }
      });
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    const data = {
      code: result.data.code,
      description: result.data.description || null,
      type: result.data.type,
      value: result.data.value,
      maxUses: result.data.maxUses ?? null,
      minPurchase: result.data.minPurchase ?? null,
      startsAt: result.data.startsAt
        ? `${result.data.startsAt}T00:00:00`
        : null,
      expiresAt: result.data.expiresAt
        ? `${result.data.expiresAt}T23:59:59`
        : null,
      isActive: result.data.isActive ?? true,
    };

    try {
      await apiFetch(isEdit ? `/discounts/${coupon.id}` : "/discounts", {
        method: isEdit ? "PATCH" : "POST",
        token: getAccessToken(),
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      addToast(
        isEdit
          ? "Cupón actualizado correctamente"
          : "Cupón creado correctamente",
        "success",
      );
      await router.replace("/discounts");
    } catch (err: unknown) {
      const { message, isLimitError } = handleLimitError(err);
      setError(message);
      addToast(message, isLimitError ? "info" : "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-8 md:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.push("/discounts")}
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a cupones
          </button>

          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 shadow-lg shadow-emerald-500/20">
              <TicketPercent className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isEdit ? "Editar cupón" : "Nuevo cupón de descuento"}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                {isEdit
                  ? "Actualiza el descuento, su cupo y su vigencia"
                  : "Define el código, el valor y cuántas veces puede usarse"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          <div
            data-ui-card
            className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8"
          >
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              Código y descuento
            </p>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="code"
                  className="text-sm font-semibold text-slate-700"
                >
                  Código del cupón *
                </Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={coupon?.code ?? ""}
                  placeholder="EJ: VERANO10"
                  maxLength={32}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                  }}
                  className={`${fieldClass} font-mono uppercase tracking-widest ${
                    fieldErrors.code ? "border-red-500" : ""
                  }`}
                />
                {fieldErrors.code && (
                  <p className="text-sm text-red-500">{fieldErrors.code}</p>
                )}
                <p className="text-xs text-slate-400">
                  De 3 a 32 caracteres: letras, números, guion o guion bajo.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-sm font-semibold text-slate-700"
                >
                  Descripción
                </Label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={coupon?.description ?? ""}
                  placeholder="Ej: Descuento de temporada para clientes frecuentes"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="type"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Tipo de descuento *
                  </Label>
                  <select
                    id="type"
                    name="type"
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value as "PERCENTAGE" | "FIXED")
                    }
                    className={`${fieldClass} cursor-pointer appearance-none ${
                      fieldErrors.type ? "border-red-500" : ""
                    }`}
                  >
                    <option value="PERCENTAGE">Porcentaje (%)</option>
                    <option value="FIXED">Monto fijo (S/)</option>
                  </select>
                  {fieldErrors.type && (
                    <p className="text-sm text-red-500">{fieldErrors.type}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="value"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Valor *
                  </Label>
                  <div className="relative">
                    <Input
                      id="value"
                      name="value"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={coupon ? String(Number(coupon.value)) : ""}
                      placeholder={type === "PERCENTAGE" ? "10" : "5.00"}
                      className={`${fieldClass} pr-14 ${
                        fieldErrors.value ? "border-red-500" : ""
                      }`}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      {type === "PERCENTAGE" ? "%" : "S/"}
                    </span>
                  </div>
                  {fieldErrors.value && (
                    <p className="text-sm text-red-500">{fieldErrors.value}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    {type === "PERCENTAGE"
                      ? "Porcentaje que se resta del subtotal (máx. 100%)."
                      : "Monto en soles que se resta del subtotal."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            data-ui-card
            className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8"
          >
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              Cupo, vigencia y estado
            </p>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="maxUses"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Cupo de usos
                  </Label>
                  <Input
                    id="maxUses"
                    name="maxUses"
                    type="number"
                    min={1}
                    step="1"
                    defaultValue={
                      coupon?.maxUses != null ? String(coupon.maxUses) : ""
                    }
                    placeholder="Ilimitado"
                    className={`${fieldClass} ${
                      fieldErrors.maxUses ? "border-red-500" : ""
                    }`}
                  />
                  {fieldErrors.maxUses && (
                    <p className="text-sm text-red-500">
                      {fieldErrors.maxUses}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    {isEdit && coupon?.maxUses != null && (
                      <>
                        {coupon.usedCount ?? 0} de {coupon.maxUses} usos
                        consumidos.
                        <br />
                      </>
                    )}
                    Déjalo vacío para usos ilimitados.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="minPurchase"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Compra mínima (S/)
                  </Label>
                  <Input
                    id="minPurchase"
                    name="minPurchase"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={
                      coupon?.minPurchase != null
                        ? String(Number(coupon.minPurchase))
                        : ""
                    }
                    placeholder="Sin mínimo"
                    className={`${fieldClass} ${
                      fieldErrors.minPurchase ? "border-red-500" : ""
                    }`}
                  />
                  {fieldErrors.minPurchase && (
                    <p className="text-sm text-red-500">
                      {fieldErrors.minPurchase}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Déjalo vacío para que aplique a cualquier venta.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="startsAt"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Vigente desde
                  </Label>
                  <Input
                    id="startsAt"
                    name="startsAt"
                    type="date"
                    defaultValue={toDateInput(coupon?.startsAt)}
                    className={`${fieldClass} ${
                      fieldErrors.startsAt ? "border-red-500" : ""
                    }`}
                  />
                  {fieldErrors.startsAt && (
                    <p className="text-sm text-red-500">
                      {fieldErrors.startsAt}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Déjalo vacío para que esté vigente desde ya.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="expiresAt"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Expira el
                  </Label>
                  <Input
                    id="expiresAt"
                    name="expiresAt"
                    type="date"
                    defaultValue={toDateInput(coupon?.expiresAt)}
                    className={`${fieldClass} ${
                      fieldErrors.expiresAt ? "border-red-500" : ""
                    }`}
                  />
                  {fieldErrors.expiresAt && (
                    <p className="text-sm text-red-500">
                      {fieldErrors.expiresAt}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Déjalo vacío para que no expire.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Cupón activo
                  </p>
                  <p className="text-xs text-slate-400">
                    Solo los cupones activos pueden aplicarse en una venta.
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              Los campos marcados con * son obligatorios
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/discounts")}
                className="h-12 w-full rounded-xl px-6 sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-600 hover:to-teal-700 sm:w-auto"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Guardar cambios" : "Crear cupón"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
