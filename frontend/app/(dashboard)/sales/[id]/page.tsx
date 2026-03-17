import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
import { SaleDetailClient } from './sale-detail-client';
import type { Sale } from '@/types/api';

interface SaleDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getSale(id: string): Promise<Sale | null> {
  const session = await auth();
  try {
    return await serverApiFetch<Sale>(`/sales/${id}`, session?.accessToken);
  } catch {
    return null;
  }
}

export default async function SaleDetailPage({ params }: SaleDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const sale = await getSale(id);

  if (!sale) {
    notFound();
  }

  return <SaleDetailClient sale={sale} />;
}
