"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui-store";
import type { CompanySettingsData } from "@/types/company-settings";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { useAuthStore } from "@/stores/auth.store";

const ZONES = [
  { value: "America/Lima", label: "Lima · Perú" },
  { value: "America/Bogota", label: "Bogotá · Colombia" },
  { value: "America/Mexico_City", label: "Ciudad de México · México" },
];

export function RegionalSettings() {
  const sessionReady = useSessionQueryReady();
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const router = useRouter();
  const cache = useQueryClient();
  const toast = useUiStore((state) => state.addToast);
  const company = useQuery({
    queryKey: ["company-current"],
    enabled: sessionReady,
    queryFn: () => apiFetch<CompanySettingsData>("/companies/current"),
  });
  const [draftZone, setDraftZone] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const zone = draftZone ?? company.data?.timezone ?? "";
  const save = useMutation({
    mutationFn: (timezone: string) =>
      apiFetch<CompanySettingsData>("/companies/current", {
        method: "PATCH",
        body: JSON.stringify({ timezone }),
      }),
    onSuccess: async (data) => {
      cache.setQueryData(["company-current"], data);
      setDraftZone(null);
      await Promise.all(
        ["sales", "reports", "dashboard"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast("Zona horaria del negocio actualizada", "success");
      router.refresh();
    },
  });
  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <Globe className="size-5 text-orange-500" />
        <h2 className="font-display text-xl font-semibold">
          Región del negocio
        </h2>
      </div>
      {!user && !authLoading && (
        <div role="alert" className="mt-4 rounded-xl border p-3 text-sm">
          No se pudo verificar la sesión para editar el negocio.{" "}
          <button
            onClick={() => void useAuthStore.getState().checkAuth()}
            className="underline"
          >
            Reintentar sesión
          </button>
        </div>
      )}
      {company.error ? (
        <div role="alert" className="mt-4 text-sm">
          No se pudo cargar la configuración.{" "}
          <button onClick={() => void company.refetch()} className="underline">
            Reintentar
          </button>
        </div>
      ) : company.data?.id ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(zone);
          }}
          className="mt-5 space-y-4"
        >
          <label className="block text-sm font-medium">
            Zona horaria
            <select
              aria-label="Zona horaria"
              value={zone}
              disabled={!ready || !sessionReady || save.isPending}
              onChange={(event) => setDraftZone(event.target.value)}
              className="mt-2 w-full rounded-xl border bg-background px-3 py-2"
            >
              {!ZONES.some(
                (entry) => entry.value === company.data.timezone,
              ) && (
                <option value={company.data.timezone}>
                  {company.data.timezone}
                </option>
              )}
              {ZONES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            Define cómo se muestran las fechas y dónde comienzan los días del
            dashboard y los reportes. Los movimientos mantienen su instante
            original en UTC.
          </p>
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/40 p-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">
                Moneda del negocio
              </p>
              <p className="mt-1 font-medium">{company.data.currency}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Idioma</p>
              <p className="mt-1 font-medium">Español</p>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            La moneda se conserva para no reinterpretar importes históricos. La
            interfaz disponible actualmente es español.
          </p>
          {save.error && (
            <p role="alert" className="text-sm text-red-600">
              {save.error.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              !ready ||
              !sessionReady ||
              !zone ||
              zone === company.data.timezone ||
              save.isPending
            }
            className="rounded-xl"
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Guardar región
          </Button>
        </form>
      ) : (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Cargando configuración regional...
        </p>
      )}
    </section>
  );
}
