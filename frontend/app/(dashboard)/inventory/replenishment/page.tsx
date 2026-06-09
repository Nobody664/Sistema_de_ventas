import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { ReplenishmentPageClient } from './replenishment-client';

export default async function ReplenishmentPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const [suggestions, forecast] = await Promise.all([
    serverApiFetch<Array<Record<string, unknown>>>('/replenishment/suggestions', accessToken),
    serverApiFetch<Array<Record<string, unknown>>>('/replenishment/forecast?days=30', accessToken),
  ]);

  return (
    <ReplenishmentPageClient
      suggestions={suggestions ?? []}
      forecast={forecast ?? []}
    />
  );
}
