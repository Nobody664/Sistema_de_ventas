import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/session-contract";
import { AppScope } from "./app-scope";
import { AppHeader } from "./app-header";
import { PlatformSidebar, PlatformMobileNav } from "./platform-sidebar";

export function PlatformShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <div data-app className="min-h-screen bg-background">
      <AppScope />
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <PlatformSidebar roles={user.roles} />
        <div className="flex min-w-0 flex-1 flex-col border-l border-foreground/10">
          <AppHeader
            companyId={null}
            fullName={user.fullName ?? ""}
            roles={user.roles}
            email={user.email}
            nav={<PlatformMobileNav roles={user.roles} />}
          />
          <main className="flex-1 p-5 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
