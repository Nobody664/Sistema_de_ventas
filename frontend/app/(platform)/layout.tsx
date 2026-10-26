import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/session";
import { PlatformShell } from "@/components/layout/platform-shell";

export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  const roles = session.user.roles ?? [];
  const isPlatformAdmin = roles.some(
    (role) => role === "SUPER_ADMIN" || role === "SUPPORT_ADMIN",
  );

  if (!isPlatformAdmin) {
    redirect("/forbidden");
  }

  return <PlatformShell user={session.user}>{children}</PlatformShell>;
}
