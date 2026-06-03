import { getServerSession } from '@/lib/session';
import { SalesPageClient } from './sales-client';
import type { Sale } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

async function serverFetch<T>(path: string, accessToken?: string): Promise<T | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export default async function SalesPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const sales = await serverFetch<Sale[]>('/sales', accessToken);

  return <SalesPageClient sales={sales ?? []} />;
}
