import Link from "next/link";
import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import type {
  PaginatedSupportConversations,
  SupportConversation,
} from "@/types/support";
import { MessageSquare } from "lucide-react";

const statusLabels: Record<string, string> = {
  OPEN: "Abierta",
  PENDING: "Pendiente",
  CLOSED: "Cerrada",
};

export default async function SupportChatPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const result = await serverApiFetch<PaginatedSupportConversations>(
    "/support/chat/conversations?limit=50",
    accessToken,
  );
  const conversations: SupportConversation[] = result?.data ?? [];

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white sm:p-8 animate-fade-in-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/20 p-3">
              <MessageSquare className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-3xl sm:text-4xl">
                Chat de soporte
              </h1>
              <p className="mt-1 text-sm text-white/70">
                {result?.total ?? 0} conversaciones
              </p>
            </div>
          </div>
          <Link
            href="/support/chat/new"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-2xl bg-white px-6 py-3 text-sm font-medium text-blue-600 transition hover:bg-white/90"
          >
            + Nueva conversación
          </Link>
        </div>
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-150">
        {conversations.length > 0 ? (
          <div className="divide-y divide-foreground/10">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/support/chat/${conversation.id}`}
                className="flex items-center justify-between gap-4 py-4 transition hover:bg-foreground/5 sm:px-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {conversation.subject ?? "Conversación de soporte"}
                  </p>
                  <p className="mt-1 text-xs text-foreground/50">
                    Último mensaje:{" "}
                    {new Date(conversation.lastMessageAt).toLocaleString(
                      "es-PE",
                    )}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/60">
                  {statusLabels[conversation.status] ?? conversation.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-foreground/50">
            Aún no hay conversaciones. Inicia una para chatear con soporte.
          </div>
        )}
      </Card>
    </div>
  );
}
