import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { serverApiFetch } from '@/lib/server-api';
import { PlansClient } from '@/components/plans/plans-client';
import type { Plan } from '@/types/api';

export default async function PlansPage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  
  if (!roles.includes('SUPER_ADMIN') && !roles.includes('SUPPORT_ADMIN')) {
    redirect('/dashboard');
  }

  const accessToken = session?.accessToken;
  const plans = await serverApiFetch<Plan[]>('/plans', accessToken);

  return <PlansClient initialPlans={plans ?? []} />;
}
