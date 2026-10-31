"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { Button } from "@/components/ui/button";
import type { NotificationPreferences } from "@/types/notification-preferences";
import { useT } from "./locale-provider";

export function NotificationSettings() {
  const t = useT();
  const ready = useSessionQueryReady();
  const cache = useQueryClient();
  const prefs = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () =>
      apiFetch<NotificationPreferences>("/notifications/preferences"),
    enabled: ready,
  });
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const values = draft ?? prefs.data;
  const save = useMutation({
    mutationFn: (body: NotificationPreferences) =>
      apiFetch<NotificationPreferences>("/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      cache.setQueryData(["notification-preferences"], data);
      setDraft(null);
    },
  });
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
        <Bell className="size-5 text-orange-500" />
        {t("Alertas dentro del sistema")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t(
          "Preferencias de tu usuario en este negocio. Se aplican a las nuevas alertas; el historial se conserva. Los avisos de cuenta y pagos siguen activos.",
        )}
      </p>
      {prefs.error ? (
        <p role="alert" className="mt-4 text-sm">
          {t("No se pudieron cargar las preferencias.")}{" "}
          <button onClick={() => void prefs.refetch()} className="underline">
            {t("Reintentar")}
          </button>
        </p>
      ) : values && typeof values.salesEnabled === "boolean" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(values);
          }}
          className="mt-4 space-y-4"
        >
          {(
            [
              ["salesEnabled", "Ventas registradas"],
              ["stockEnabled", "Stock bajo y vencimientos"],
              ["soundEnabled", "Sonido de nuevas alertas"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl border p-3 text-sm"
            >
              <span>{t(label)}</span>
              <input
                type="checkbox"
                checked={values[key]}
                disabled={!ready || save.isPending}
                onChange={(event) =>
                  setDraft({ ...values, [key]: event.target.checked })
                }
              />
            </label>
          ))}
          <Button
            type="submit"
            disabled={!draft || save.isPending}
            className="rounded-xl"
          >
            {t("Guardar alertas")}
          </Button>
          {save.error && (
            <p role="alert" className="text-sm text-red-600">
              {save.error.message}
            </p>
          )}
          {save.isSuccess && !draft && (
            <p role="status" className="text-sm text-emerald-600">
              {t("Preferencias guardadas.")}
            </p>
          )}
        </form>
      ) : (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          {t("Cargando preferencias...")}
        </p>
      )}
    </section>
  );
}
