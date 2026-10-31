"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import Link from "next/link";
import { useT } from "./locale-provider";

interface DangerZoneProps {
  canCancelSubscription: boolean;
}

const buttonClassName =
  "rounded-xl border border-red-200 bg-card px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50";

export function DangerZone({ canCancelSubscription }: DangerZoneProps) {
  const t = useT();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancelSubscription = async () => {
    setLoading(true);
    setError(null);

    try {
      await apiFetch("/subscriptions/cancel", {
        method: "POST",
        token: getAccessToken(),
      });
      router.refresh();
      addToast(t("Suscripción cancelada correctamente"), "success");
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al cancelar la suscripción";
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-[30px] border border-red-100 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/30">
      <h2 className="font-display text-xl text-red-800 dark:text-red-300">
        {t("Zona de peligro")}
      </h2>
      <p className="mt-1 text-red-600/70 dark:text-red-400/70">
        {t("Estas acciones son irreversibles")}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/support" className={buttonClassName}>
          {t("Solicitar cierre del negocio")}
        </Link>

        {canCancelSubscription ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={buttonClassName}
          >
            {t("Cancelar suscripción")}
          </button>
        ) : (
          <span
            title={t(
              "Solo el administrador de la empresa puede cancelar la suscripción.",
            )}
          >
            <button
              type="button"
              disabled
              className={`${buttonClassName} cursor-not-allowed opacity-60`}
            >
              {t("Cancelar suscripción")}
            </button>
          </span>
        )}
      </div>

      <p className="mt-4 text-sm text-red-600/70 dark:text-red-400/70">
        {t(
          "La eliminación de cuenta no está disponible en esta versión; contacta al soporte si necesitas cerrar la empresa.",
        )}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("Cancelar suscripción")}</DialogTitle>
            <DialogDescription>
              {t(
                "Tu suscripción se marcará como cancelada y la renovación automática se desactivará. Esta acción no se puede deshacer.",
              )}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("Volver")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Confirmar cancelación")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
