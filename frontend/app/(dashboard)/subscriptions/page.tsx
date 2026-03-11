import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { serverApiFetch } from '@/lib/server-api';
import { SubscriptionsClient } from '@/components/subscriptions/subscriptions-client';
import type { Company, Plan } from '@/types/api';

export default async function SubscriptionsPage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  
  if (!roles.includes('SUPER_ADMIN')) {
    redirect('/dashboard');
  }

  const accessToken = session?.accessToken;

  const [companies, plans] = await Promise.all([
    serverApiFetch<Company[]>('/companies', accessToken),
    serverApiFetch<Plan[]>('/plans', accessToken),
  ]);

  return <SubscriptionsClient companies={companies ?? []} plans={plans ?? []} />;
}
