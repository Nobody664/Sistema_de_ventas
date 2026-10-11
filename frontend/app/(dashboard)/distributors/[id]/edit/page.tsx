import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { DistributorForm } from '@/components/distributors/distributor-form';
import type { Distributor } from '@/types/distributors';

export default async function EditDistributorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const distributor = await serverApiFetch<Distributor>(`/distributors/${id}`, session.accessToken);

  if (!distributor) {
    redirect('/distributors');
  }

  return <DistributorForm distributor={distributor} />;
}
