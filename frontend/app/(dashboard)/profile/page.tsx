import { auth } from '@/auth';
import { serverApiFetch } from '@/lib/server-api';
import { ProfileClient } from '@/components/profile/profile-client';
import { SuperAdminProfileClient } from '@/components/profile/super-admin-profile-client';

type Subscription = {
  status: string;
  provider: string | null;
  billingCycle: string;
  endDate: string | null;
  startDate: string | null;
  plan?: { name: string; priceMonthly: string; code: string; features?: string[] };
};

type Company = {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
  status: string;
  trialEndsAt: string | null;
  createdAt: string;
};

type DashboardStats = {
  totalCompanies: number;
  activeCompanies: number;
  trialCompanies: number;
  totalUsers: number;
  totalSubscriptions: number;
};

export default async function ProfilePage() {
  const session = await auth();
  
  const userRoles = session?.user?.roles ?? [];
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPPORT_ADMIN');

  if (isSuperAdmin) {
    const accessToken = session?.accessToken;
    let stats: DashboardStats | null = null;
    let companies: Company[] = [];
    
    if (accessToken) {
      try {
        stats = await serverApiFetch<DashboardStats>('/dashboard/global', accessToken);
      } catch {}
      try {
        companies = await serverApiFetch<Company[]>('/companies', accessToken) ?? [];
      } catch {}
    }

    return (
      <SuperAdminProfileClient 
        userName={session?.user?.name ?? ''}
        userEmail={session?.user?.email ?? ''}
        stats={stats}
        companies={companies}
      />
    );
  }

  if (!session?.user?.companyId) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-foreground/50">No tienes una empresa asignada.</p>
        </div>
      </div>
    );
  }

  const accessToken = session.accessToken;

  const [subscription, company] = await Promise.all([
    serverApiFetch<Subscription>('/subscriptions/current', accessToken),
    serverApiFetch<Company>('/companies/current', accessToken),
  ]);

  const userName = session.user.name ?? '';
  const userEmail = session.user.email ?? '';

  return (
    <ProfileClient 
      initialSubscription={subscription} 
      initialCompany={company}
      userName={userName}
      userEmail={userEmail}
    />
  );
}
