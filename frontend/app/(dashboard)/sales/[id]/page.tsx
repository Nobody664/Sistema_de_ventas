
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { SaleDetailClient } from './sale-detail-client';
import type { Sale } from '@/types/api';

interface SaleDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getSale(id: string, accessToken: string | undefined): Promise<Sale | null> {
  try {
    return await serverApiFetch<Sale>(`/sales/${id}`, accessToken);
  } catch {
    return null;
  }
}

export default async function SaleDetailPage({ params }: SaleDetailPageProps) {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const sale = await getSale(id, accessToken);

  if (!sale) {
    notFound();
  }

  return <SaleDetailClient sale={sale} />;
}
