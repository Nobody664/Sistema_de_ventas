import Link from "next/link";
import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import type { PaginatedSupportTickets, SupportTicket } from "@/types/support";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/types/support";
import { Ticket } from "lucide-react";

const statusColors: Record<string, string> = {
  OPEN: "bg-blue-500/15 text-blue-600",
  IN_PROGRESS: "bg-amber-500/15 text-amber-600",
  PENDING_CUSTOMER: "bg-purple-500/15 text-purple-600",
  RESOLVED: "bg-emerald-500/15 text-emerald-600",
  CLOSED: "bg-foreground/10 text-foreground/60",
};

const priorityColors: Record<string, string> = {
  LOW: "bg-foreground/10 text-foreground/60",
  MEDIUM: "bg-blue-500/15 text-blue-600",
  HIGH: "bg-orange-500/15 text-orange-600",
  URGENT: "bg-red-500/15 text-red-600",
};

export default async function SupportTicketsPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const result = await serverApiFetch<PaginatedSupportTickets>(
    "/support/tickets?limit=50",
    accessToken,
  );
  const tickets: SupportTicket[] = result?.data ?? [];

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-amber-600 p-6 text-white sm:p-8 animate-fade-in-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/20 p-3">
              <Ticket className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-3xl sm:text-4xl">
                Tickets de soporte
              </h1>
              <p className="mt-1 text-sm text-white/70">
                {result?.total ?? 0} tickets registrados
              </p>
            </div>
          </div>
          <Link
            href="/support/tickets/new"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-2xl bg-white px-6 py-3 text-sm font-medium text-orange-600 transition hover:bg-white/90"
          >
            + Nuevo ticket
          </Link>
        </div>
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-150">
        {tickets.length > 0 ? (
          <div className="divide-y divide-foreground/10">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/support/tickets/${ticket.id}`}
                className="flex flex-col gap-3 py-4 transition hover:bg-foreground/5 sm:flex-row sm:items-center sm:justify-between sm:px-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{ticket.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/50">
                    <span className="rounded-full bg-foreground/5 px-2 py-0.5">
                      {ticket.company?.name ?? "—"}
                    </span>
                    <span>
                      {new Date(ticket.createdAt).toLocaleDateString("es-PE")}
                    </span>
                    {ticket.assignedTo && (
                      <span>Asignado a {ticket.assignedTo.fullName}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityColors[ticket.priority]}`}
                  >
                    {TICKET_PRIORITY_LABELS[ticket.priority]}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[ticket.status]}`}
                  >
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-foreground/50">
            Aún no hay tickets. Crea el primero para solicitar ayuda.
          </div>
        )}
      </Card>
    </div>
  );
}
