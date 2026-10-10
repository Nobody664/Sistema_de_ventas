import { redirect } from 'next/navigation';

import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { PlansClient } from '@/components/plans/plans-client';
import type { Plan } from '@/types/api';

export default async function PlansPage() {
  const session = await getServerSession();
  const roles: string[] = session?.user?.roles || [];
  
  if (!roles.includes('SUPER_ADMIN') && !roles.includes('SUPPORT_ADMIN')) {
    redirect('/dashboard');
  }

  const accessToken = session?.accessToken;
  const plans = await serverApiFetch<Plan[]>('/plans', accessToken);

  return <PlansClient initialPlans={plans ?? []} />;
}
