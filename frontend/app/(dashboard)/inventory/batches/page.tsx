import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { BatchesPageClient } from './batches-client';

export default async function BatchesPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const [batches, products, branches, expiring] = await Promise.all([
    serverApiFetch<Array<Record<string, unknown>>>('/product-batches', accessToken),
    serverApiFetch<Array<{ id: string; name: string }>>('/products', accessToken),
    serverApiFetch<Array<{ id: string; name: string }>>('/branches', accessToken),
    serverApiFetch<Array<Record<string, unknown>>>('/product-batches/expiring?days=7', accessToken),
  ]);

  return (
    <BatchesPageClient
      initialBatches={batches ?? []}
      products={products ?? []}
      branches={branches ?? []}
      expiringBatches={expiring ?? []}
    />
  );
}
