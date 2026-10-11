import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { DistributorForm } from '@/components/distributors/distributor-form';

export default async function NewDistributorPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  return <DistributorForm />;
}
