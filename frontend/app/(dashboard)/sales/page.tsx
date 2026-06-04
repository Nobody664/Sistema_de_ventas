import { getServerSession } from '@/lib/session';
import { serverApiFetch } from '@/lib/server-api';
import { SalesPageClient } from './sales-client';
import type { Sale } from '@/types/api';

export default async function SalesPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const sales = await serverApiFetch<Sale[]>('/sales', accessToken);

  return <SalesPageClient sales={sales ?? []} />;
}
