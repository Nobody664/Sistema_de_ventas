import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import { SupportTicketDetailView } from "@/components/support/support-ticket-detail-view";
import type { SupportTicketDetail } from "@/types/support";

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const ticket = await serverApiFetch<SupportTicketDetail>(
    `/support/tickets/${id}`,
    accessToken,
  );

  if (!ticket) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/support/tickets"
        className="flex items-center gap-2 text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a tickets
      </Link>
      <SupportTicketDetailView ticket={ticket} />
    </div>
  );
}
