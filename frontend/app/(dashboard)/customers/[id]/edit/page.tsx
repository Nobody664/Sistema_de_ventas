import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { CustomerForm } from '@/components/customers/customer-form';
import { serverApiFetch } from '@/lib/server-api';
import type { Customer } from '@/types/api';

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

async function getCustomer(id: string): Promise<Customer | null> {
  const session = await auth();
  try {
    return await serverApiFetch<Customer>(`/customers/${id}`, session?.accessToken);
  } catch {
    return null;
  }
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) {
    notFound();
  }

  return <CustomerForm customer={customer} />;
}
