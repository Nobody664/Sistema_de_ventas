import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { fetchPlanCapabilities } from "@/lib/plan-capabilities-server";
import { PlanCapabilitiesProvider } from "@/components/plan-capabilities/plan-capabilities-provider";
import { PlanRouteGuard } from "@/components/plan-capabilities/plan-route-guard";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar, AppMobileNav } from "@/components/layout/app-sidebar";
import { AppScope } from "@/components/layout/app-scope";
import { TrialBanner } from "@/components/layout/trial-banner";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  const { companyStatus, companyId } = session.user;

  if (companyStatus === "INACTIVE") {
    redirect("/plan-expired");
  }

  if (companyStatus === "SUSPENDED") {
    redirect("/account-suspended");
  }

  const capabilities = await fetchPlanCapabilities(session.accessToken);

  return (
    <PlanCapabilitiesProvider capabilities={capabilities}>
      <div data-app className="min-h-screen bg-background">
        <AppScope />
        <TrialBanner
          companyStatus={companyStatus ?? ""}
          trialEndsAt={session.user.trialEndsAt ?? null}
          roles={session.user.roles}
        />
        <div className="mx-auto flex min-h-screen max-w-[1600px]">
          <AppSidebar roles={session.user.roles} />
          <div className="flex min-w-0 flex-1 flex-col border-l border-foreground/10">
            <AppHeader
              companyId={companyId ?? null}
              fullName={session.user.fullName}
              roles={session.user.roles}
              email={session.user.email ?? ""}
              nav={<AppMobileNav roles={session.user.roles} />}
            />
            <main className="flex-1 p-5 md:p-8">
              <PlanRouteGuard roles={session.user.roles}>
                {children}
              </PlanRouteGuard>
            </main>
          </div>
        </div>
      </div>
    </PlanCapabilitiesProvider>
  );
}
