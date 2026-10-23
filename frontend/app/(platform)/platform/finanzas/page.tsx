import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { PlatformFinanceClient } from "@/components/platform/platform-finance-client";

export default async function PlatformFinancePage() {
  const session = await getServerSession();
  if (!session?.user?.roles.includes("SUPER_ADMIN")) redirect("/forbidden");
  return <PlatformFinanceClient />;
}
