"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { sessionScope } from "@/lib/session-contract";
import { useAuthStore } from "@/stores/auth.store";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { usePlanCapabilities } from "@/components/plan-capabilities/plan-capabilities-provider";
import { Button } from "@/components/ui/button";
import { useT } from "./locale-provider";

interface ApiKeyMetadata {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

const scopes = [
  ["catalog.read", "Consultar catálogo"],
  ["inventory.read", "Consultar stock"],
  ["sales.read", "Consultar ventas"],
] as const;

export function ApiKeySettings() {
  const t = useT();
  const ready = useSessionQueryReady();
  const user = useAuthStore((state) => state.user);
  const scope = sessionScope(user);
  const current = useRef(scope);
  current.current = scope;
  const { capabilities } = usePlanCapabilities();
  const cache = useQueryClient();
  const keys = useQuery({
    queryKey: ["integration-api-keys"],
    enabled: ready,
    queryFn: () => apiFetch<ApiKeyMetadata[]>("/integrations/api-keys"),
  });
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>(["catalog.read"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    setSecret(null);
    setError("");
    setStatus("");
    setName("");
    setPending(false);
  }, [scope]);

  const run = async (path: string, body?: unknown): Promise<void> => {
    const startedScope = scope;
    if (!ready || pending) return;
    setPending(true);
    setError("");
    setSecret(null);
    try {
      const response = await apiFetch<ApiKeyMetadata & { key?: string }>(path, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      });
      if (current.current !== startedScope) return;
      setSecret(response.key ?? null);
      setStatus(
        response.key
          ? "Clave creada. Guarda el valor ahora; no podrás volver a consultarlo."
          : "Clave revocada.",
      );
      setName("");
      await cache.invalidateQueries({ queryKey: ["integration-api-keys"] });
    } catch (cause) {
      if (current.current === startedScope)
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo guardar la clave",
        );
    } finally {
      if (current.current === startedScope) setPending(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
        <KeyRound className="size-5 text-orange-500" />
        {t("API Keys de solo lectura")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t(
          "Conecta sistemas externos sin compartir tu contraseña. Cada clave pertenece a este negocio, vence a los 90 días y puede revocarse. Las consultas consumen la cuota mensual de API de tu plan.",
        )}
      </p>
      {!capabilities?.apiEnabled && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t(
            "Tu plan no incluye acceso a la API. Puedes consultar y revocar claves existentes.",
          )}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run("/integrations/api-keys", { name, scopes: permissions });
        }}
        className="mt-4 space-y-3"
      >
        <label className="block text-sm font-medium">
          {t("Nombre de la integración")}
          <input
            value={name}
            minLength={2}
            maxLength={80}
            required
            disabled={pending || !capabilities?.apiEnabled}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border bg-background px-3 py-2"
          />
        </label>
        <fieldset
          disabled={pending || !capabilities?.apiEnabled}
          className="flex flex-wrap gap-4"
        >
          <legend className="mb-2 text-sm font-medium">
            {t("Permisos de lectura")}
          </legend>
          {scopes.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={permissions.includes(value)}
                onChange={(event) =>
                  setPermissions(
                    event.target.checked
                      ? [...permissions, value]
                      : permissions.filter((item) => item !== value),
                  )
                }
              />
              {t(label)}
            </label>
          ))}
        </fieldset>
        <Button
          disabled={
            !ready ||
            pending ||
            !capabilities?.apiEnabled ||
            !permissions.length
          }
        >
          {t("Crear API Key")}
        </Button>
      </form>
      {status && (
        <p role="status" className="mt-3 text-sm">
          {t(status)}
        </p>
      )}
      {secret && (
        <div className="mt-3 rounded-xl border border-orange-500/40 bg-orange-500/5 p-4">
          <p className="text-sm font-semibold">
            {t("Valor visible solo en esta respuesta")}
          </p>
          <code
            className="mt-2 block break-all text-xs"
            aria-label={t("Nueva API Key")}
          >
            {secret}
          </code>
          <Button
            variant="outline"
            onClick={() => setSecret(null)}
            className="mt-3"
          >
            {t("Ocultar clave")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {keys.error ? (
        <p role="alert" className="mt-4 text-sm">
          {t("No se pudieron cargar las claves.")}{" "}
          <button className="underline" onClick={() => void keys.refetch()}>
            {t("Reintentar")}
          </button>
        </p>
      ) : keys.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("Cargando claves...")}
        </p>
      ) : (
        <ul className="mt-4 divide-y">
          {keys.data?.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div>
                <p className="text-sm font-medium">{key.name}</p>
                <p className="text-xs text-muted-foreground">
                  {key.scopes.join(" · ")} ·{" "}
                  {key.revokedAt
                    ? t("Revocada")
                    : `${t("Vence")} ${key.expiresAt.slice(0, 10)}`}
                </p>
              </div>
              {!key.revokedAt && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void run(`/integrations/api-keys/${key.id}/revoke`)
                  }
                >
                  {t("Revocar")} {key.name}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium">
          {t("Contrato de consulta")}
        </summary>
        <p className="mt-2 leading-6 text-muted-foreground">
          {t(
            "GET /api/integrations/v1/catalog · /inventory · /sales. Envía la clave en X-API-Key. Cada respuesta incluye hasta 100 registros y nextCursor; usa ?after=nextCursor para continuar. Los decimales se devuelven como cadenas. No hay endpoints de escritura.",
          )}
        </p>
      </details>
    </section>
  );
}
