"use client";

import { useRouter } from "next/navigation";
import { useAdminQuery, useAdminWrite } from "../api/queries";
import { Panel, QueryState, commerceButton } from "./commerce-ui";

export function ExperienceControl({ legacy = false }: { legacy?: boolean }) {
  const query = useAdminQuery<{
    enabled: boolean;
    eligible: boolean;
    reason: string | null;
    version: number;
  }>("experience");
  const write = useAdminWrite();
  const router = useRouter();
  return (
    <Panel>
      <h2 className="font-display text-xl font-semibold">
        Experiencia administrativa
      </h2>
      <p className="my-3 text-sm text-foreground/55">
        Cambiar de panel no modifica la tienda pública, las compras ni los datos
        guardados.
      </p>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <>
          <p className="mb-3 text-sm">
            {query.data.enabled
              ? "Centro de tienda activado"
              : "Panel anterior activado"}
          </p>
          {!query.data.eligible && (
            <p className="mb-3 text-xs text-foreground/55">
              El despliegue todavía no habilita el Centro de tienda para esta
              empresa.
            </p>
          )}
          <button
            className={commerceButton}
            disabled={
              write.isPending || (!query.data.enabled && !query.data.eligible)
            }
            onClick={async () => {
              const enabled = !query.data!.enabled;
              try {
                await write.mutateAsync({
                  resource: "experience",
                  body: { enabled, expectedVersion: query.data!.version ?? 0 },
                });
                if (legacy && enabled) router.replace("/comercio");
              } catch {
                await query.refetch();
              }
            }}
          >
            {write.isPending
              ? "Actualizando…"
              : query.data.enabled
                ? "Volver al panel anterior"
                : "Usar Centro de tienda"}
          </button>
        </>
      )}
      {write.error && (
        <p role="alert" className="mt-4 text-sm">
          {write.error.message}
        </p>
      )}
    </Panel>
  );
}
