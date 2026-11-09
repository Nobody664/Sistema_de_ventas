import { redirect } from "next/navigation";
import { getCommerceSession } from "@/features/store-admin/api/server";
import { CommerceDashboard } from "@/features/store-admin/components/commerce-dashboard";

export default async function CommerceSummaryPage() {
  const { context } = await getCommerceSession();
  if (!context.capabilities.viewDashboard)
    redirect("/comercio/atencion/pedidos");
  return <CommerceDashboard />;
}
