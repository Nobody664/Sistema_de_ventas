import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
import { SubscriptionPageClient } from '@/components/subscriptions/subscription-page-client';
import type { Plan, Subscription } from '@/types/api';

interface PlanUpgradeRequest {
  id: string;
  status: string;
  currentPlan: { code: string; name: string };
  newPlan: { code: string; name: string };
}

export default async function SubscriptionPage() {
  const session = await auth();
  
  if (!session?.user?.companyId) {
    redirect('/sign-in');
  }

  const accessToken = session.accessToken;

  const [subscription, plans, pendingRequest] = await Promise.all([
    serverApiFetch<Subscription>(`/subscriptions/current`, accessToken),
    serverApiFetch<Plan[]>('/plans', accessToken),
    serverApiFetch<PlanUpgradeRequest | null>('/subscriptions/upgrade-requests/my/pending', accessToken),
  ]);

  return (
    <SubscriptionPageClient 
      initialSubscription={subscription} 
      initialPlans={plans ?? []}
      pendingUpgrade={pendingRequest}
    />
  );
}
