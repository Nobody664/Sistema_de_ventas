import { redirect } from 'next/navigation';

import { getServerSession } from '@/lib/session';
import { AppScope } from '@/components/layout/app-scope';
import { PlatformSidebar } from '@/components/layout/platform-sidebar';
import { AppHeader } from '@/components/layout/app-header';

export default async function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const roles = session.user.roles ?? [];
  const isPlatformAdmin = roles.some((role) => role === 'SUPER_ADMIN' || role === 'SUPPORT_ADMIN');

  if (!isPlatformAdmin) {
    redirect('/forbidden');
  }

  return (
    <div data-app className="min-h-screen bg-background">
      <AppScope />
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <PlatformSidebar roles={roles} />
        <div className="flex min-w-0 flex-1 flex-col border-l border-foreground/10">
          <AppHeader
            companyId={session.user.companyId ?? null}
            fullName={session.user.fullName}
            roles={roles}
            email={session.user.email ?? ''}
          />
          <main className="flex-1 p-5 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}