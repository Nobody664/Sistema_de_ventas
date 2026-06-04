import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { serverApiFetch } from '@/lib/server-api';
import { PaymentHistoryClient } from '@/components/payments/payment-history';

interface BillingStatus {
  subscription: {
    id: string;
    status: string;
    plan: { id: string; name: string; code: string; priceMonthly: string };
    startDate: string;
    endDate: string;
    autoRenew: boolean;
    billingCycle: string;
  };
  currentPending: {
    id: string;
    amount: string;
    dueDate: string;
    status: string;
    hasProof: boolean;
  } | null;
  lastPayment: {
    id: string;
    amount: string;
    paidAt: string;
    status: string;
  } | null;
  recentPayments: Array<{
    id: string;
    amount: string;
    status: string;
    dueDate: string;
    paidAt: string;
    createdAt: string;
    hasProof: boolean;
    proofStatus: string;
  }>;
}

export default async function PaymentsPage() {
  const session = await getServerSession();
  if (!session?.user?.companyId) {
    redirect('/sign-in');
  }

  const accessToken = session?.accessToken;
  const roles: string[] = session?.user?.roles || [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');

  const [billingStatus, pendingPayments, paymentHistory] = await Promise.all([
    serverApiFetch<BillingStatus>('/billing/status', accessToken),
    serverApiFetch<{ id: string; amount: string; dueDate: string; status: string; subscriptionId: string }[]>('/payments/current-pending', accessToken),
    serverApiFetch<{ data: unknown[]; total: number }>('/payments/history', accessToken),
  ]);

  return (
    <PaymentHistoryClient
      billingStatus={billingStatus}
      pendingPayments={pendingPayments}
      paymentHistory={paymentHistory}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
