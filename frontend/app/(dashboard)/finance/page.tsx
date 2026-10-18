import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import type { FinanceListResponse, FinanceSummary } from '@/types/api';
import { FinancePageClient } from './finance-client';

export const dynamic = 'force-dynamic';

interface FinancePageProps {
  searchParams: Promise<{
    page?: string;
    from?: string;
    to?: string;
    direction?: string;
    category?: string;
    search?: string;
  }>;
}

interface EmployeeOptionResponse {
  id: string;
  firstName: string;
  lastName: string | null;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes('COMPANY_ADMIN')) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.from) query.set('from', `${params.from}T00:00:00`);
  if (params.to) query.set('to', `${params.to}T23:59:59`);
  if (params.direction) query.set('direction', params.direction);
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', params.page);

  const listQuery = new URLSearchParams(query);
  if (!listQuery.has('page')) listQuery.set('page', '1');
  listQuery.set('limit', '20');

  const [list, summary, employees] = await Promise.all([
    serverApiFetch<FinanceListResponse>(`/finance?${listQuery.toString()}`, session.accessToken),
    serverApiFetch<FinanceSummary>(`/finance/summary?${query.toString()}`, session.accessToken),
    serverApiFetch<EmployeeOptionResponse[]>('/employees', session.accessToken),
  ]);

  const employeeOptions = (employees ?? []).map((employee) => ({
    id: employee.id,
    name: `${employee.firstName}${employee.lastName ? ` ${employee.lastName}` : ''}`,
  }));

  return (
    <FinancePageClient
      initialList={list ?? { items: [], total: 0, page: 1, limit: 20 }}
      initialSummary={summary ?? null}
      employees={employeeOptions}
    />
  );
}
