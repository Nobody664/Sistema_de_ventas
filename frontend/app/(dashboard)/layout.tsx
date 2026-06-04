import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TrialBanner } from '@/components/layout/trial-banner';

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { companyStatus, companyId } = session.user;

  if (companyStatus === 'INACTIVE') {
    redirect('/plan-expired');
  }

  if (companyStatus === 'SUSPENDED') {
    redirect('/account-suspended');
  }

  return (
    <div className="min-h-screen bg-background">
      <TrialBanner
        companyStatus={companyStatus ?? ''}
        trialEndsAt={session.user.trialEndsAt ?? null}
      />
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <AppSidebar roles={session.user.roles} />
        <div className="flex min-w-0 flex-1 flex-col border-l border-foreground/10">
          <AppHeader
            companyId={companyId ?? null}
            fullName={session.user.fullName}
            roles={session.user.roles}
            email={session.user.email ?? ''}
          />
          <main className="flex-1 p-5 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}