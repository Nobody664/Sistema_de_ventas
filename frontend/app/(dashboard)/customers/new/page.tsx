
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { CustomerForm } from '@/components/customers/customer-form';

export default async function NewCustomerPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  return <CustomerForm />;
}
