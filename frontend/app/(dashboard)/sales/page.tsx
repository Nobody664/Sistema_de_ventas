import { getServerSession } from "@/lib/session";
import { serverApiFetch } from "@/lib/server-api";
import { SalesPageClient } from "./sales-client";
import type { Sale } from "@/types/api";
import type { SalesMetrics } from "@/types/sales";

export default async function SalesPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const [sales, metrics] = await Promise.all([
    serverApiFetch<Sale[]>("/sales?page=1&limit=20", accessToken),
    serverApiFetch<SalesMetrics>("/dashboard/tenant", accessToken),
  ]);

  return <SalesPageClient sales={sales ?? []} metrics={metrics} />;
}
