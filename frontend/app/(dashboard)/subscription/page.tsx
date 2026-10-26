import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { serverApiFetch } from "@/lib/server-api";
import { SubscriptionPageClient } from "@/components/subscriptions/subscription-page-client";
import type { Plan, Subscription } from "@/types/api";
import type { PendingPlanUpgrade } from "@/types/subscriptions";
import { isPlatformUser } from "@/lib/role-navigation";

interface ProfileCompleteness {
  score: number;
  totalFields: number;
  completedFields: number;
  missingFields: string[];
  complete: boolean;
}

export default async function SubscriptionPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  const roles = session.user.roles;
  if (!session.user.companyId) {
    redirect(isPlatformUser(roles) ? "/platform" : "/forbidden");
  }
  if (!roles.includes("COMPANY_ADMIN")) {
    redirect("/dashboard");
  }

  const accessToken = session?.accessToken;

  const [subscription, plans, pendingRequest, completeness] = await Promise.all(
    [
      serverApiFetch<Subscription>(`/subscriptions/current`, accessToken, {
        allowEmpty: true,
      }),
      serverApiFetch<Plan[]>("/plans", accessToken),
      serverApiFetch<PendingPlanUpgrade | null>(
        "/subscriptions/upgrade-requests/my/pending",
        accessToken,
        { allowEmpty: true },
      ),
      serverApiFetch<ProfileCompleteness>(
        "/company-profile/completeness",
        accessToken,
      ),
    ],
  );

  return (
    <SubscriptionPageClient
      initialSubscription={subscription}
      initialPlans={plans ?? []}
      pendingUpgrade={pendingRequest}
      initialCompleteness={
        completeness?.complete
          ? { complete: true, missingFields: [] }
          : {
              complete: false,
              missingFields: completeness?.missingFields ?? [],
            }
      }
    />
  );
}
