import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
import { SaleForm } from '@/components/sales/sale-form';
import type { Product, Customer } from '@/types/api';

export default async function NewSalePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const accessToken = session.accessToken;

  const [products, customers] = await Promise.all([
    serverApiFetch<Product[]>('/products', accessToken),
    serverApiFetch<Customer[]>('/customers', accessToken),
  ]);

  return <SaleForm products={products ?? []} customers={customers ?? []} />;
}
