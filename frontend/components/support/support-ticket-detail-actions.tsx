"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import {
  TICKET_STATUS_LABELS,
  type SupportTicketDetail,
  type SupportTicketStatus,
} from "@/types/support";

const STATUS_OPTIONS: SupportTicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING_CUSTOMER",
  "RESOLVED",
  "CLOSED",
];

export function SupportTicketDetailActions({
  ticket,
  canManage,
}: {
  ticket: SupportTicketDetail;
  canManage: boolean;
}) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [status, setStatus] = useState<SupportTicketStatus>(ticket.status);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [saving, setSaving] = useState(false);

  const changeStatus = async (next: SupportTicketStatus) => {
    setSaving(true);
    try {
      await apiFetch(`/support/tickets/${ticket.id}/status`, {
        method: "PATCH",
        token: getAccessToken(),
        body: JSON.stringify({ status: next }),
      });
      setStatus(next);
      addToast("Estado actualizado", "success");
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const submittedComment = comment;
    setSaving(true);
    try {
      await apiFetch(`/support/tickets/${ticket.id}/comments`, {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({ content: submittedComment.trim(), isInternal }),
      });
      setComment((current) => (current === submittedComment ? "" : current));
      addToast("Comentario agregado", "success");
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    setSaving(true);
    try {
      await apiFetch(`/support/tickets/${ticket.id}/reopen`, {
        method: "POST",
        token: getAccessToken(),
      });
      addToast("Ticket reabierto", "success");
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-foreground/10 bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">
          Respuesta
        </p>
        <form onSubmit={submitComment} className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Escribe una respuesta..."
            className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canManage ? (
              <label className="flex items-center gap-2 text-sm text-foreground/60">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                />
                {isInternal ? (
                  <Lock className="size-3.5" />
                ) : (
                  <Unlock className="size-3.5" />
                )}
                Comentario interno
              </label>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              disabled={saving || !comment.trim()}
              className="h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-5 font-semibold text-white"
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Enviar
            </Button>
          </div>
        </form>
      </div>

      {canManage && (
        <div className="space-y-3 rounded-2xl border border-foreground/10 bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">
            Gestión
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                disabled={saving || option === status}
                onClick={() => changeStatus(option)}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                  option === status
                    ? "bg-orange-500 text-white"
                    : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                }`}
              >
                {TICKET_STATUS_LABELS[option]}
              </button>
            ))}
          </div>
          {(status === "RESOLVED" || status === "CLOSED") && (
            <Button
              type="button"
              variant="outline"
              onClick={reopen}
              disabled={saving}
              className="h-10 rounded-xl"
            >
              Reabrir ticket
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
