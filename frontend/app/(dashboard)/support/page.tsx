import Link from "next/link";
import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import type { SupportTicketMetrics } from "@/types/support";
import { LifeBuoy, Ticket, MessageSquare, BookOpen, Clock } from "lucide-react";

const links = [
  {
    href: "/support/tickets",
    label: "Tickets",
    description: "Gestiona incidencias y solicitudes de soporte.",
    icon: Ticket,
    accent: "from-orange-500 to-amber-600",
  },
  {
    href: "/support/chat",
    label: "Chat de soporte",
    description: "Conversaciones en vivo con el equipo de soporte.",
    icon: MessageSquare,
    accent: "from-blue-500 to-indigo-600",
  },
  {
    href: "/support/faqs",
    label: "Preguntas frecuentes",
    description: "Base de conocimiento y respuestas rápidas.",
    icon: BookOpen,
    accent: "from-emerald-500 to-teal-600",
  },
];

export default async function SupportHubPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const metrics = await serverApiFetch<SupportTicketMetrics>(
    "/support/tickets/metrics",
    accessToken,
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-amber-600 p-6 text-white sm:p-8 animate-fade-in-up">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/20 p-3">
            <LifeBuoy className="size-7" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">
              Centro de ayuda
            </p>
            <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              Soporte
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              Crea tickets, conversa con el equipo de soporte y consulta la base
              de conocimientos.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-orange-500/20 p-2">
              <Ticket className="size-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Tickets abiertos
              </p>
              <p className="font-display text-3xl">
                {metrics?.openTickets ?? 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/20 p-2">
              <Clock className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Primera respuesta (min)
              </p>
              <p className="font-display text-3xl">
                {metrics?.avgFirstResponseMinutes ?? 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-2">
              <Clock className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Resolución (min)
              </p>
              <p className="font-display text-3xl">
                {metrics?.avgResolutionMinutes ?? 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Card className="h-full rounded-[30px] bg-white/85 p-6 card-hover">
                <div
                  className={`inline-flex rounded-2xl bg-gradient-to-br ${link.accent} p-3 text-white`}
                >
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-4 font-display text-xl">{link.label}</h2>
                <p className="mt-2 text-sm text-foreground/60">
                  {link.description}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
