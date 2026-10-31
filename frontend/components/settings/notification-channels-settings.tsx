"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Mail } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { sessionScope } from "@/lib/session-contract";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { useT } from "./locale-provider";

interface Preferences {
  available: boolean;
  dailyDigestEnabled: boolean;
  locale: "es" | "en";
  hour: string;
}
interface PushConfig {
  available: boolean;
  publicKey: string | null;
  subscriptions: Array<{ id: string; endpointHash: string; createdAt: string }>;
}

function vapidKey(value: string): ArrayBuffer {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0)).buffer;
}

export function NotificationChannelsSettings() {
  const t = useT();
  const ready = useSessionQueryReady();
  const user = useAuthStore((state) => state.user);
  const scope = sessionScope(user);
  const latest = useRef(scope);
  latest.current = scope;
  const cache = useQueryClient();
  const prefs = useQuery({
    queryKey: ["notification-channels"],
    enabled: ready,
    queryFn: () => apiFetch<Preferences>("/notification-channels/preferences"),
  });
  const push = useQuery({
    queryKey: ["web-push"],
    enabled: ready,
    queryFn: () => apiFetch<PushConfig>("/notification-channels/push"),
  });
  const [supported, setSupported] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [draftDigest, setDraftDigest] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(
      window.isSecureContext &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
  }, []);
  useEffect(() => {
    setPending(false);
    setError("");
    setStatus("");
    setDraftDigest(null);
  }, [scope]);

  const run = async (action: () => Promise<void>): Promise<void> => {
    if (!ready || pending) return;
    setPending(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (cause) {
      if (latest.current === scope) {
        setDraftDigest(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo completar la operación",
        );
      }
    } finally {
      if (latest.current === scope) setPending(false);
    }
  };

  const subscribe = async (): Promise<void> => {
    if (!push.data?.publicKey || !supported) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw new Error(
        "El navegador no concedió permiso. Puedes cambiarlo desde sus ajustes de notificaciones.",
      );
    if (latest.current !== scope) return;
    const registration = await navigator.serviceWorker.register(
      "/notifications-sw.js",
      { scope: "/" },
    );
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey(push.data.publicKey),
      }));
    if (latest.current !== scope) return;
    const json = subscription.toJSON();
    await apiFetch("/notification-channels/push", {
      method: "POST",
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    if (latest.current !== scope) return;
    await cache.invalidateQueries({ queryKey: ["web-push"] });
    setStatus("Este navegador quedó registrado para Web Push.");
  };

  const remove = async (id: string, endpointHash: string): Promise<void> => {
    await apiFetch(`/notification-channels/push/${id}/remove`, {
      method: "POST",
    });
    if (latest.current !== scope) return;
    if (supported) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(subscription.endpoint),
        );
        const hash = Array.from(new Uint8Array(digest), (part) =>
          part.toString(16).padStart(2, "0"),
        ).join("");
        if (hash === endpointHash) await subscription.unsubscribe();
      }
    }
    await cache.invalidateQueries({ queryKey: ["web-push"] });
    setStatus("Navegador eliminado de Web Push.");
  };

  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
        <BellRing className="size-5 text-orange-500" />
        {t("Canales de notificación")}
      </h2>
      <div className="mt-5 space-y-6">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="size-4" />
            {t("Resumen diario por correo")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t(
              "Resumen de las ventas completadas del día anterior, enviado a las 08:00 de la zona horaria del negocio al correo de tu cuenta.",
            )}
          </p>
          {prefs.data && !prefs.data.available && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("El correo no está habilitado en el servidor.")}
            </p>
          )}
          {prefs.error && (
            <p role="alert" className="mt-2 text-sm">
              {t("No se pudo cargar la preferencia.")}{" "}
              <button
                className="underline"
                onClick={() => void prefs.refetch()}
              >
                {t("Reintentar")}
              </button>
            </p>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label={t("Recibir resumen diario")}
              checked={draftDigest ?? prefs.data?.dailyDigestEnabled === true}
              disabled={
                !ready ||
                pending ||
                !prefs.data ||
                (!prefs.data.available && !prefs.data.dailyDigestEnabled)
              }
              onChange={(event) => {
                const enabled = event.target.checked;
                setDraftDigest(enabled);
                void run(async () => {
                  const result = await apiFetch<Preferences>(
                    "/notification-channels/preferences",
                    {
                      method: "PATCH",
                      body: JSON.stringify({ dailyDigestEnabled: enabled }),
                    },
                  );
                  if (latest.current === scope) {
                    cache.setQueryData(["notification-channels"], result);
                    setDraftDigest(null);
                    setStatus("Preferencia de resumen guardada.");
                  }
                });
              }}
            />
            {t("Recibir resumen diario")}
          </label>
        </div>
        <div className="border-t pt-5">
          <h3 className="text-sm font-semibold">
            {t("Web Push en el navegador")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t(
              "Recibe avisos genéricos del sistema con la pestaña cerrada, según el soporte del navegador y del sistema operativo. El contenido del negocio solo se muestra al abrir tu sesión.",
            )}
          </p>
          {!supported && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("Este navegador no ofrece Web Push en el contexto actual.")}
            </p>
          )}
          {push.data && !push.data.available && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "El canal necesita claves VAPID y cifrado habilitados en el servidor.",
              )}
            </p>
          )}
          <Button
            className="mt-3"
            disabled={!ready || pending || !supported || !push.data?.available}
            onClick={() => void run(subscribe)}
          >
            {t("Activar en este navegador")}
          </Button>
          {push.error && (
            <p role="alert" className="mt-2 text-sm">
              {t("No se pudo cargar Web Push.")}{" "}
              <button className="underline" onClick={() => void push.refetch()}>
                {t("Reintentar")}
              </button>
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {push.data?.subscriptions?.map((subscription, index) => (
              <li
                key={subscription.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
              >
                <span className="text-sm">
                  {t("Navegador")} {index + 1} ·{" "}
                  {subscription.createdAt.slice(0, 10)}
                </span>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void run(() =>
                      remove(subscription.id, subscription.endpointHash),
                    )
                  }
                >
                  {t("Eliminar navegador")} {index + 1}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {status && (
        <p role="status" className="mt-3 text-sm">
          {t(status)}
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
