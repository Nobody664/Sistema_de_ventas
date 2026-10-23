export interface PlatformAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
  initialBalance: number;
  isActive: boolean;
  notes: string | null;
  income: number;
  expense: number;
  balance: number;
}

export interface PlatformTransaction {
  id: string;
  accountId: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  amount: number;
  currency: string;
  occurredAt: string;
  account: { id: string; name: string; type: string };
}

export interface PlatformFinanceSummary {
  currency: string;
  totals: {
    subscriptionRevenue: number;
    manualIncome: number;
    totalIncome: number;
    totalExpense: number;
    net: number;
    payments: number;
    transactions: number;
  };
  accounts: PlatformAccount[];
  monthly: { month: string; income: number; expense: number; net: number }[];
  expensesByCategory: { category: string; amount: number }[];
}

export interface PlatformCompanyRevenue {
  id: string;
  name: string;
  email: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  monthRevenue: number;
}

export interface ApiProvider {
  id: string;
  slug: string;
  name: string;
  unit: string;
  costPerUnit: number;
  currency: string;
  isActive: boolean;
}

export interface PlatformApiSummary {
  period: string;
  totals: {
    requests: number;
    tokens: number;
    companies: number;
    enabledCompanies: number;
  };
  companies: {
    companyId: string;
    companyName: string;
    planName: string | null;
    apiEnabled: boolean;
    requests: number;
    tokens: number;
    quota: number;
    usagePercent: number;
  }[];
  providers: {
    providerId: string;
    name: string;
    unit: string;
    tokens: number;
    cost: number;
    currency: string;
  }[];
  providerCatalog: ApiProvider[];
}
