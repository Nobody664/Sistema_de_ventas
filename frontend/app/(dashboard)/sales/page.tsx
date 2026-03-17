import { auth } from '@/auth';
import { serverApiFetch } from '@/lib/server-api';
import { SalesPageClient } from './sales-client';
import type { Sale } from '@/types/api';

export default async function SalesPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  console.log('SalesPage: session', !!session, 'accessToken', !!accessToken, 'companyId', session?.user?.companyId);

  const sales = await serverApiFetch<Sale[]>('/sales', accessToken);

  console.log('SalesPage: sales result', sales);

  return <SalesPageClient sales={sales ?? []} />;
}
