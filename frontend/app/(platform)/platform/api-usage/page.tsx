import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { PlatformApiUsageClient } from "@/components/platform/platform-api-usage-client";

export default async function ApiUsagePage() {
  const session = await getServerSession();
  if (
    !session?.user ||
    !session.user.roles.some((role) =>
      ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(role),
    )
  )
    redirect("/forbidden");
  return (
    <PlatformApiUsageClient
      canManage={session.user.roles.includes("SUPER_ADMIN")}
    />
  );
}
