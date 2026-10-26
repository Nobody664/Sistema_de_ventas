export interface BillingStatus {
  subscription: {
    id: string;
    status: string;
    plan: {
      id: string;
      name: string;
      code: string;
      priceMonthly: string;
      priceYearly?: string;
    };
    startDate: string | null;
    endDate: string | null;
    autoRenew: boolean;
    billingCycle: string;
  };
  currentPending: {
    id: string;
    amount: string;
    dueDate: string | null;
    status: string;
    hasProof: boolean;
    proofStatus: string | null;
  } | null;
  lastPayment: {
    id: string;
    amount: string;
    paidAt: string | null;
    status: string;
  } | null;
  recentPayments: Array<{
    id: string;
    amount: string;
    status: string;
    dueDate: string | null;
    paidAt: string | null;
    createdAt: string;
    hasProof: boolean;
    proofStatus: string | null;
  }>;
}
