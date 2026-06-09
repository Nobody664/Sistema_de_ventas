import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { InventoryPageClient } from './inventory-client';

export default async function InventoryPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const [summary, expiring, suggestions] = await Promise.all([
    serverApiFetch<{ totalValue: string; entries: Array<Record<string, unknown>> }>('/kardex/summary', accessToken),
    serverApiFetch<Array<Record<string, unknown>>>('/product-batches/expiring?days=7', accessToken),
    serverApiFetch<Array<Record<string, unknown>>>('/replenishment/suggestions', accessToken),
  ]);

  return (
    <InventoryPageClient
      totalValue={summary?.totalValue ?? '0'}
      expiringCount={expiring?.length ?? 0}
      suggestionsCount={suggestions?.length ?? 0}
    />
  );
}
