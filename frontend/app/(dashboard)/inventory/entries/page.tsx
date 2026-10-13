import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { StockEntriesClient } from './entries-client';

export interface StockEntryProductOption {
  id: string;
  name: string;
  sku: string | null;
  baseUnit: string;
  stockQuantity: string;
  presentations: Array<{ id: string; name: string; factor: string; price: string | null }>;
}

export default async function StockEntriesPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const [entries, products, branches] = await Promise.all([
    serverApiFetch<Array<Record<string, unknown>>>('/stock-entries', accessToken),
    serverApiFetch<StockEntryProductOption[]>('/products', accessToken),
    serverApiFetch<Array<{ id: string; name: string }>>('/branches', accessToken),
  ]);

  return (
    <StockEntriesClient
      initialEntries={entries ?? []}
      products={products ?? []}
      branches={branches ?? []}
    />
  );
}
