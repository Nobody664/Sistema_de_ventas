import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import {
  ReportsClient,
  type ReportOverview,
} from "@/components/reports/reports-client";

export default async function ReportsPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const report = await serverApiFetch<ReportOverview>(
    "/reports/overview",
    accessToken,
  );

  const initial: ReportOverview = report ?? {
    totalSales: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    averageTicket: 0,
    revenueChange: 0,
    topProducts: [],
    salesByDay: [],
    byChannel: [],
    filters: { channel: null, startDate: null, endDate: null },
  };

  return <ReportsClient initial={initial} />;
}
