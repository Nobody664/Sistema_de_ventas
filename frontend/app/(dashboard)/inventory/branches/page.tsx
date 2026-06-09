import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { BranchesPageClient } from './branches-client';

export default async function BranchesPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const branches = await serverApiFetch<Array<Record<string, unknown>>>('/branches', accessToken);

  return <BranchesPageClient initialBranches={branches ?? []} />;
}
