"use client";

import { PermissionGuard } from "@/components/auth/permission-guard";
import {
  TICKET_STATUS_LABELS,
  type SupportTicketDetail,
} from "@/types/support";
import { usePermissions } from "@/hooks/usePermissions";
import { SupportTicketDetailActions } from "./support-ticket-detail-actions";

const statusColors: Record<string, string> = {
  OPEN: "bg-blue-500/15 text-blue-600",
  IN_PROGRESS: "bg-amber-500/15 text-amber-600",
  PENDING_CUSTOMER: "bg-purple-500/15 text-purple-600",
  RESOLVED: "bg-emerald-500/15 text-emerald-600",
  CLOSED: "bg-foreground/10 text-foreground/60",
};

export function SupportTicketDetailView({
  ticket,
}: {
  ticket: SupportTicketDetail;
}) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("support:ticket_manage");

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-foreground/10 bg-card p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[ticket.status]}`}
            >
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
            <span className="text-xs text-foreground/50">
              {new Date(ticket.createdAt).toLocaleString("es-PE")}
            </span>
          </div>
          <h2 className="mt-4 font-display text-2xl">{ticket.title}</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/70">
            {ticket.description}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">
            Conversación ({ticket.comments.length})
          </p>
          {ticket.comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-2xl border p-4 ${
                comment.isInternal
                  ? "border-amber-200 bg-amber-50/60"
                  : "border-foreground/10 bg-card"
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <span className="font-medium">
                  {comment.author?.fullName ?? "Sistema"}
                </span>
                {comment.isInternal && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-700">
                    Interno
                  </span>
                )}
                <span>
                  {new Date(comment.createdAt).toLocaleString("es-PE")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {comment.content}
              </p>
            </div>
          ))}
          {ticket.comments.length === 0 && (
            <p className="text-sm text-foreground/50">
              Sin respuestas todavía.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-3 rounded-2xl border border-foreground/10 bg-card p-5 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground/50">Solicitante</span>
            <span>{ticket.requester?.fullName ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/50">Asignado</span>
            <span>{ticket.assignedTo?.fullName ?? "Sin asignar"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/50">Origen</span>
            <span>{ticket.source}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/50">SLA</span>
            <span>
              {ticket.slaDueAt
                ? new Date(ticket.slaDueAt).toLocaleString("es-PE")
                : "—"}
            </span>
          </div>
        </div>

        <PermissionGuard permission="support:ticket_manage">
          <SupportTicketDetailActions ticket={ticket} canManage={canManage} />
        </PermissionGuard>
      </div>
    </div>
  );
}
