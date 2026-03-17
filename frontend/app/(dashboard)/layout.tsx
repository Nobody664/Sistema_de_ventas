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
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <AppSidebar roles={session.user.roles} />
        <div className="flex min-w-0 flex-1 flex-col border-l border-foreground/10">
          <AppHeader
            companyId={session.user.companyId ?? null}
            fullName={session.user.name ?? session.user.email ?? 'Usuario'}
            roles={session.user.roles}
            email={session.user.email ?? ''}
          />
          <main className="flex-1 p-5 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
