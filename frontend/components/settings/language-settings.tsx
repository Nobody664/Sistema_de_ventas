"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { localeFromValue } from "@/lib/i18n";
import { useLocale, useT } from "./locale-provider";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { Button } from "@/components/ui/button";

export function LanguageSettings({ owner }: { owner: boolean }) {
  const locale = useLocale();
  const t = useT();
  const ready = useSessionQueryReady();
  const [draft, setDraft] = useState(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const cache = useQueryClient();
  const save = async (): Promise<void> => {
    if (!ready || pending) return;
    setPending(true);
    setError("");
    try {
      if (owner)
        await apiFetch("/notification-channels/preferences", {
          method: "PATCH",
          body: JSON.stringify({ locale: draft }),
        });
      document.cookie = `ventas_locale=${draft}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      await cache.invalidateQueries({ queryKey: ["notification-channels"] });
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar el idioma",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
        <Languages className="size-5 text-orange-500" />
        {t("Idioma")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t(
          "Configura el idioma de Configuración y de tus resúmenes y avisos Web Push. Los datos escritos por usuarios conservan su idioma original.",
        )}
      </p>
      <form
        className="mt-4 flex flex-wrap items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <select
          aria-label={t("Idioma")}
          value={draft}
          disabled={!ready || pending}
          onChange={(event) => setDraft(localeFromValue(event.target.value))}
          className="rounded-xl border bg-background px-3 py-2"
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <Button disabled={!ready || pending || locale === draft}>
          {t("Guardar idioma")}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
