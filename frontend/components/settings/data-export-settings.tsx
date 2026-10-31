"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { downloadBusinessData } from "@/lib/business-data-export";
import { sessionScope } from "@/lib/session-contract";
import { useAuthStore } from "@/stores/auth.store";

export function DataExportSettings() {
  const ready = useSessionQueryReady();
  const user = useAuthStore((state) => state.user);
  const scope = sessionScope(user);
  const active = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = null;
    setPending(false);
    setStatus("");
    setError("");
    return () => active.current?.abort();
  }, [scope]);

  const download = async (): Promise<void> => {
    if (!ready || !user?.companyId || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setError("");
    setStatus("Preparando exportación...");
    try {
      const blob = await downloadBusinessData(
        user.companyId,
        controller.signal,
        (message) => {
          if (sessionScope(useAuthStore.getState().user) === scope)
            setStatus(message);
        },
      );
      if (sessionScope(useAuthStore.getState().user) !== scope) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `datos-negocio-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Archivo JSON descargado.");
    } catch (cause) {
      if (sessionScope(useAuthStore.getState().user) !== scope) return;
      if (controller.signal.aborted) setStatus("Exportación cancelada.");
      else
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo exportar. Intenta nuevamente.",
        );
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPending(false);
      }
    }
  };
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
        <Download className="size-5 text-orange-500" />
        Datos del negocio
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Descarga tus datos operativos en JSON versionado: catálogo, ventas,
        compras, inventario, contactos y finanzas. No incluye credenciales ni
        datos de plataforma.
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Se lee por lotes y puede reflejar cambios durante la descarga. No es un
        respaldo físico ni un archivo de restauración automática. Límite de
        descarga: 100 MiB.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          disabled={!ready || pending}
          onClick={() => void download()}
          className="rounded-xl"
        >
          {pending ? "Exportando..." : "Descargar datos JSON"}
        </Button>
        {pending && (
          <Button variant="outline" onClick={() => active.current?.abort()}>
            Cancelar exportación
          </Button>
        )}
      </div>
      {status && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
