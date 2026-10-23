"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

export function SupportTicketForm() {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      title: (formData.get("title") as string)?.trim(),
      description: (formData.get("description") as string)?.trim(),
      priority: formData.get("priority") as string,
    };

    if (!payload.title || !payload.description) {
      setError("El título y la descripción son obligatorios.");
      setLoading(false);
      return;
    }

    try {
      const ticket = await apiFetch<{ id: string }>("/support/tickets", {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify(payload),
      });
      addToast("Ticket creado correctamente", "success");
      router.push(`/support/tickets/${ticket.id}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <button
        onClick={() => router.push("/support/tickets")}
        className="flex items-center gap-2 text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a tickets
      </button>

      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 p-3 shadow-lg shadow-orange-500/20">
          <Ticket className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-foreground">
            Nuevo ticket
          </h1>
          <p className="text-sm text-foreground/50">
            Describe tu problema o solicitud
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-6 rounded-2xl border border-foreground/10 bg-card p-6 md:p-8">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-semibold">
              Título *
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="Resumen breve del problema"
              maxLength={200}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority" className="text-sm font-semibold">
              Prioridad
            </Label>
            <select
              id="priority"
              name="priority"
              defaultValue="MEDIUM"
              className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold">
              Descripción *
            </Label>
            <textarea
              id="description"
              name="description"
              rows={6}
              maxLength={5000}
              placeholder="Detalla lo que necesitas..."
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/support/tickets")}
            className="h-12 rounded-xl px-6"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-8 font-semibold text-white shadow-lg shadow-orange-500/25"
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Crear ticket
          </Button>
        </div>
      </form>
    </div>
  );
}
