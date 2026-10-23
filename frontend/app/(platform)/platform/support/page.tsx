import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { PlatformSupportClient } from "@/components/platform/platform-support-client";

export default async function PlatformSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string; chat?: string }>;
}) {
  const [session, query] = await Promise.all([
    getServerSession(),
    searchParams,
  ]);
  if (
    !session?.user ||
    !session.user.roles.some((role) =>
      ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(role),
    )
  )
    redirect("/forbidden");
  return (
    <PlatformSupportClient
      userId={session.user.id}
      initialTicket={query.ticket}
      initialChat={query.chat}
    />
  );
}
