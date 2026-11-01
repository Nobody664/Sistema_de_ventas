import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { StoreAdmin } from "@/components/store/store-admin";

export default async function StoreAdminPage() {
  const session = await getServerSession();
  if (!session?.user?.roles.includes("COMPANY_ADMIN")) redirect("/forbidden");
  return <StoreAdmin />;
}
