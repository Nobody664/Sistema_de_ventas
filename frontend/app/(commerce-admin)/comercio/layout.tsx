import { getCommerceSession } from "@/features/store-admin/api/server";
import { CommerceShell } from "@/features/store-admin/components/commerce-shell";

export default async function CommerceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { context, user } = await getCommerceSession();
  return (
    <CommerceShell context={context} userId={user.id}>
      {children}
    </CommerceShell>
  );
}
