import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { CustomerForm } from '@/components/customers/customer-form';

export default async function NewCustomerPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  return <CustomerForm />;
}
