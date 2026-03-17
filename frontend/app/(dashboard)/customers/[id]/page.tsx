import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
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

async function getCustomer(id: string): Promise<Customer | null> {
  const session = await auth();
  try {
    return await serverApiFetch<Customer>(`/customers/${id}`, session?.accessToken);
  } catch {
    return null;
  }
}

async function getCustomerPurchases(id: string): Promise<CustomerWithPurchases | null> {
  const session = await auth();
  try {
    return await serverApiFetch<CustomerWithPurchases>(`/customers/${id}/purchases`, session?.accessToken);
  } catch {
    return null;
  }
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const [customer, purchasesData] = await Promise.all([
    getCustomer(id),
    getCustomerPurchases(id),
  ]);

  if (!customer) {
    notFound();
  }

  return <CustomerDetailClient customer={customer} purchasesData={purchasesData} />;
}
