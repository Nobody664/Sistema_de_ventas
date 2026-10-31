import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { serverApiFetch } from "@/lib/server-api";
import { isPlatformUser } from "@/lib/role-navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import type { DashboardOverview } from "@/types/dashboard";
import { getCompanySettings } from "@/lib/company-settings-server";
import { validCompanyZone } from "@/lib/company-format";

async function DashboardDataLoader() {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");
  if (isPlatformUser(session.user.roles)) redirect("/platform");
  const [data, companySettings] = await Promise.all([
    serverApiFetch<DashboardOverview>("/dashboard/tenant", session.accessToken),
    getCompanySettings(session.accessToken),
  ]);
  const timeZone = validCompanyZone(companySettings?.timezone);
  const overview: DashboardOverview | null = data
    ? {
        company: data.company
          ? { name: data.company.name, currency: data.company.currency }
          : null,
        salesScope: data.salesScope,
        salesToday: data.salesToday,
        revenueToday: data.revenueToday,
        inventoryMetrics: {
          lowStockCount: data.inventoryMetrics.lowStockCount,
          outOfStockCount: data.inventoryMetrics.outOfStockCount,
        },
        dataCoverage: data.dataCoverage
          ? { inventory: data.dataCoverage.inventory }
          : undefined,
      }
    : null;
  const consulted = new Date();
  return (
    <DashboardClient
      tenantMetrics={overview}
      roles={session.user.roles}
      dateLabel={new Intl.DateTimeFormat("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone,
      }).format(consulted)}
      consultedAt={new Intl.DateTimeFormat("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }).format(consulted)}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando resumen"
      className="mx-auto max-w-6xl space-y-7 motion-safe:animate-pulse"
    >
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-10 w-64 max-w-full rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-56 rounded-2xl border border-border/50 bg-card"
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-72 rounded-2xl bg-card" />
        <div className="h-72 rounded-2xl bg-card" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardDataLoader />
    </Suspense>
  );
}
