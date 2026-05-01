
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { CustomerDetailClient } from './customer-detail-client';
import type { Customer, Sale } from '@/types/api';

interface CustomerWithPurchases {
  purchases: Sale[];
  stats: {
    totalSpent: number;
    purchaseCount: number;
    lastPurchaseDate: string | null;
    averageTicket: number;
  };
}

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getCustomer(id: string, accessToken: string | undefined): Promise<Customer | null> {
  try {
    return await serverApiFetch<Customer>(`/customers/${id}`, accessToken);
  } catch {
    return null;
  }
}

async function getCustomerPurchases(id: string, accessToken: string | undefined): Promise<CustomerWithPurchases | null> {
  try {
    return await serverApiFetch<CustomerWithPurchases>(`/customers/${id}/purchases`, accessToken);
  } catch {
    return null;
  }
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const [customer, purchasesData] = await Promise.all([
    getCustomer(id, accessToken),
    getCustomerPurchases(id, accessToken),
  ]);

  if (!customer) {
    notFound();
  }

  return <CustomerDetailClient customer={customer} purchasesData={purchasesData} />;
}
