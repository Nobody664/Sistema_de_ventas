"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Webhook } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { sessionScope } from "@/lib/session-contract";
import { useAuthStore } from "@/stores/auth.store";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { usePlanCapabilities } from "@/components/plan-capabilities/plan-capabilities-provider";
import { Button } from "@/components/ui/button";
import { useT } from "./locale-provider";

interface Endpoint {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
}
interface Config {
  available: boolean;
  allowedHosts: string[];
  endpoints: Endpoint[];
}
interface Delivery {
  id: string;
  eventId: string;
  attempts: number;
  deliveredAt: string | null;
  stoppedAt: string | null;
  statusCode: number | null;
  lastError: string | null;
}

export function WebhookSettings() {
  const t = useT();
  const ready = useSessionQueryReady();
  const user = useAuthStore((state) => state.user);
  const scope = sessionScope(user);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const { canFeature } = usePlanCapabilities();
  const cache = useQueryClient();
  const config = useQuery({
    queryKey: ["outgoing-webhooks"],
    enabled: ready,
    queryFn: () => apiFetch<Config>("/integrations/webhooks"),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ["webhook-history", selected],
    enabled: ready && !!selected,
    queryFn: () =>
      apiFetch<Delivery[]>(`/integrations/webhooks/${selected}/deliveries`),
  });
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setSecret(null);
    setSelected(null);
    setPending(false);
    setError("");
    setMessage("");
    setName("");
    setUrl("");
  }, [scope]);
  const run = async (path: string, body: unknown = {}): Promise<void> => {
    if (!ready || pending) return;
    setPending(true);
    setError("");
    setSecret(null);
    try {
      const result = await apiFetch<{ secret?: string }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (activeScope.current !== scope) return;
      setSecret(result.secret ?? null);
      setMessage(
        result.secret
          ? "Webhook creado. Guarda el secreto de firma; se muestra una sola vez."
          : "Webhook desactivado.",
      );
      setName("");
      setUrl("");
      await cache.invalidateQueries({ queryKey: ["outgoing-webhooks"] });
    } catch (cause) {
      if (activeScope.current === scope)
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo guardar el webhook",
        );
    } finally {
      if (activeScope.current === scope) setPending(false);
    }
  };
  const available = config.data?.available && canFeature("webhooks.manage");
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
        <Webhook className="size-5 text-orange-500" />
        {t("Webhooks salientes")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t(
          "Envía el evento sale.created a tu integración por HTTPS. La entrega es al menos una vez: usa X-Ventas-Delivery para deduplicar y valida la firma HMAC del cuerpo antes de procesarlo.",
        )}
      </p>
      {!canFeature("webhooks.manage") && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("Tu plan no incluye webhooks salientes.")}
        </p>
      )}
      {config.data && !config.data.available && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t(
            "El canal necesita una clave de cifrado y hosts de destino habilitados en el servidor.",
          )}
        </p>
      )}
      {!!config.data?.allowedHosts?.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("Hosts habilitados")}: {config.data.allowedHosts.join(", ")}
        </p>
      )}
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run("/integrations/webhooks", { name, url });
        }}
      >
        <label className="block text-sm font-medium">
          {t("Nombre del webhook")}
          <input
            required
            minLength={2}
            maxLength={80}
            value={name}
            disabled={!available || pending}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          {t("URL HTTPS de destino")}
          <input
            type="url"
            required
            maxLength={1000}
            value={url}
            disabled={!available || pending}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://integracion.example.com/ventas"
            className="mt-2 w-full rounded-xl border bg-background px-3 py-2"
          />
        </label>
        <Button disabled={!ready || pending || !available}>
          {t("Crear webhook")}
        </Button>
      </form>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {t(message)}
        </p>
      )}
      {secret && (
        <div className="mt-3 rounded-xl border border-orange-500/40 p-4">
          <code
            className="block break-all text-xs"
            aria-label={t("Secreto de firma")}
          >
            {secret}
          </code>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => setSecret(null)}
          >
            {t("Ocultar secreto")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {config.error && (
        <p role="alert" className="mt-3 text-sm">
          {t("No se pudieron cargar los webhooks.")}{" "}
          <button className="underline" onClick={() => void config.refetch()}>
            {t("Reintentar")}
          </button>
        </p>
      )}
      <ul className="mt-4 divide-y">
        {config.data?.endpoints?.map((endpoint) => (
          <li key={endpoint.id} className="space-y-2 py-4">
            <p className="text-sm font-medium">
              {endpoint.name} ·{" "}
              {t(endpoint.isActive ? "Activo" : "Desactivado")}
            </p>
            <p className="break-all text-xs text-muted-foreground">
              {endpoint.url}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setSelected(endpoint.id)}
              >
                {t("Ver entregas de")} {endpoint.name}
              </Button>
              {endpoint.isActive && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void run(`/integrations/webhooks/${endpoint.id}/disable`)
                  }
                >
                  {t("Desactivar")} {endpoint.name}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="mt-4 rounded-xl border p-4">
          <h3 className="text-sm font-semibold">{t("Últimas 50 entregas")}</h3>
          {history.error ? (
            <p role="alert" className="mt-2 text-sm">
              {t("No se pudo cargar el historial.")}{" "}
              <button
                className="underline"
                onClick={() => void history.refetch()}
              >
                {t("Reintentar")}
              </button>
            </p>
          ) : history.isPending ? (
            <p className="mt-2 text-sm">{t("Cargando entregas...")}</p>
          ) : !history.data?.length ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("Todavía no hay entregas.")}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {history.data.map((delivery) => (
                <li key={delivery.id} className="break-all text-xs">
                  {delivery.id} ·{" "}
                  {t(
                    delivery.deliveredAt
                      ? "Entregado"
                      : delivery.stoppedAt
                        ? "Detenido"
                        : "Pendiente",
                  )}{" "}
                  · {delivery.attempts} {t("intentos")} · HTTP{" "}
                  {delivery.statusCode ?? t("sin respuesta")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium">
          {t("Verificación y reintentos")}
        </summary>
        <p className="mt-2 leading-6 text-muted-foreground">
          {t(
            'X-Ventas-Signature contiene v1=HMAC-SHA256(secreto, timestamp + "." + cuerpo JSON exacto). Verifica X-Ventas-Timestamp con una tolerancia de cinco minutos. El identificador de entrega permanece estable durante hasta diez intentos con espera creciente, de uno a sesenta minutos. No se siguen redirecciones.',
          )}
        </p>
      </details>
    </section>
  );
}
