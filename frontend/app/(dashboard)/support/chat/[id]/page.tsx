import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import { SupportChatView } from "@/components/support/support-chat-view";
import type { SupportConversation } from "@/types/support";

export default async function SupportChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const conversation = await serverApiFetch<SupportConversation>(
    `/support/chat/conversations/${id}`,
    accessToken,
  );

  if (!conversation) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/support/chat"
        className="flex items-center gap-2 text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a conversaciones
      </Link>
      <SupportChatView conversation={conversation} />
    </div>
  );
}
