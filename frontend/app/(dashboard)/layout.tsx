import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-[#fbf6ef]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[280px_1fr]">
        <AppSidebar roles={session.user.roles} />
        <div className="border-l border-foreground/10">
          <AppHeader
            companyId={session.user.companyId ?? null}
            fullName={session.user.name ?? session.user.email ?? 'Usuario'}
            roles={session.user.roles}
            email={session.user.email ?? ''}
          />
          <main className="p-5 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
