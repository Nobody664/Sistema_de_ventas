import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { KardexPageClient } from './kardex-client';
import type { InventoryKardex } from '@/types/api';

export default async function KardexPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const [entries, products] = await Promise.all([
    serverApiFetch<InventoryKardex[]>('/kardex', accessToken),
    serverApiFetch<Array<{ id: string; name: string; sku: string | null }>>('/products', accessToken),
  ]);

  return (
    <KardexPageClient
      initialEntries={(entries ?? []) as unknown as Array<Record<string, unknown>>}
      products={products ?? []}
    />
  );
}
