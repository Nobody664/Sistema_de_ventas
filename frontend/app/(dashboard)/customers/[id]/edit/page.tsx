
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { CustomerForm } from '@/components/customers/customer-form';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import type { Customer } from '@/types/api';

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

async function getCustomer(id: string, accessToken: string | undefined): Promise<Customer | null> {
  try {
    return await serverApiFetch<Customer>(`/customers/${id}`, accessToken);
  } catch {
    return null;
  }
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const customer = await getCustomer(id, accessToken);

  if (!customer) {
    notFound();
  }

  return <CustomerForm customer={customer} />;
}
