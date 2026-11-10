"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { storeApi, StoreApiError } from "@/lib/store-api";
import {
  BUYER_ORDER_UPDATED,
  isBuyerNotificationFeed,
  latestBuyerOrderUpdates,
  type BuyerNotificationFeed,
} from "@/lib/store-notifications";
import { storeButton } from "./store-ui";

export function StoreBuyerNotifications({
  slug,
  accountId,
  onNotice,
  onSessionChange,
}: {
  slug: string;
  accountId: string;
  onNotice: (message: string) => void;
  onSessionChange: () => void;
}) {
  const [feed, setFeed] = useState<BuyerNotificationFeed | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const mounted = useRef(false);
  const reload = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    mounted.current = true;
    let active = true;
    let stopped = false;
    let pending = false;
    let generation = 0;
    let controller: AbortController | null = null;
    let initialized = false;
    let known = new Set<string>();
    const load = async (force = false) => {
      if (!active || stopped || (pending && !force)) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const current = ++generation;
      pending = true;
      try {
        const value = await storeApi<unknown>(
          slug,
          "me/notifications/feed",
          undefined,
          undefined,
          { signal: request.signal },
        );
        if (!active || current !== generation) return;
        if (!isBuyerNotificationFeed(value))
          throw new Error("No se pudieron validar los avisos de tu tienda");
        if (value.accountId !== accountId) {
          stopped = true;
          setFeed(null);
          onSessionChange();
          return;
        }
        const fresh = value.data.filter((notice) => !known.has(notice.id));
        known = new Set(value.data.map((notice) => notice.id));
        setFeed(value);
        setError("");
        for (const notice of latestBuyerOrderUpdates(fresh))
          window.dispatchEvent(
            new CustomEvent(BUYER_ORDER_UPDATED, {
              detail: {
                slug,
                accountId,
                orderId: notice.orderId,
                version: notice.version,
              },
            }),
          );
        if (initialized && fresh.length)
          onNotice(`${fresh[0].order.number}: ${fresh[0].message}`);
        initialized = true;
      } catch (cause) {
        if (!active || request.signal.aborted || current !== generation) return;
        if (
          cause instanceof StoreApiError &&
          [401, 403].includes(cause.status)
        ) {
          stopped = true;
          setFeed(null);
          onSessionChange();
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudieron actualizar tus avisos",
        );
      } finally {
        if (current === generation) pending = false;
      }
    };
    reload.current = () => load(true);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const focus = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    void load();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      active = false;
      mounted.current = false;
      controller?.abort();
      reload.current = async () => {};
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [slug, accountId, onNotice, onSessionChange]);
  const read = async (id?: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await storeApi(
        slug,
        id
          ? `me/notifications/${encodeURIComponent(id)}/read`
          : "me/notifications/read",
        {},
      );
      if (mounted.current) await reload.current();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error ? cause.message : "No se pudo marcar el aviso",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Novedades de tus pedidos: ${feed?.unreadCount ?? 0} sin leer`}
          className="inline-flex items-center gap-2 rounded-full border border-teal-900/20 px-3 py-2 text-sm font-semibold text-teal-900 dark:text-teal-100"
        >
          <Bell className="size-4" />
          {(feed?.unreadCount ?? 0) > 0 && (
            <span
              aria-hidden="true"
              className="rounded-full bg-teal-900 px-2 py-0.5 text-xs text-white"
            >
              {feed!.unreadCount > 99 ? "99+" : feed!.unreadCount}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Novedades de tus pedidos</DialogTitle>
        <DialogDescription>
          Avisos de esta tienda, actualizados automáticamente. Consulta tu
          pedido para ver su estado e historial.
        </DialogDescription>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy}
            className="text-sm font-semibold underline"
            onClick={() => void reload.current()}
          >
            Actualizar avisos
          </button>
          <button
            disabled={busy || !feed?.unreadCount}
            className="text-sm underline"
            onClick={() => void read()}
          >
            Marcar todos como leídos
          </button>
        </div>
        {error && (
          <p role="alert" className="rounded-xl border p-3 text-sm">
            {error}
          </p>
        )}
        {!feed && !error && <p role="status">Cargando avisos…</p>}
        {feed?.data.length === 0 && (
          <p className="text-sm">Todavía no hay avisos de pedidos.</p>
        )}
        <ol className="space-y-3">
          {feed?.data.map((notice) => (
            <li
              key={notice.id}
              className={`rounded-xl border p-4 text-sm ${notice.readAt ? "border-foreground/10" : "border-primary/40 bg-primary/5"}`}
            >
              <p className="font-semibold">
                {notice.order.number}
                {!notice.readAt ? " · Nuevo" : ""}
              </p>
              <p className="my-2 whitespace-pre-wrap break-words">
                {notice.message}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  className="font-semibold underline"
                  href={`/tienda/${encodeURIComponent(slug)}/pedidos/${encodeURIComponent(notice.orderId)}`}
                  onClick={() => setOpen(false)}
                >
                  Ver pedido
                </Link>
                {!notice.readAt && (
                  <button
                    disabled={busy}
                    onClick={() => void read(notice.id)}
                    className="text-xs underline"
                  >
                    Marcar como leído
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <Link
          href={`/tienda/${encodeURIComponent(slug)}/pedidos`}
          onClick={() => setOpen(false)}
          className={storeButton}
        >
          Ver mis pedidos
        </Link>
      </DialogContent>
    </Dialog>
  );
}
