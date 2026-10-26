import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { serverApiFetch } from "@/lib/server-api";
import { PaymentHistoryClient } from "@/components/payments/payment-history";
import type { BillingStatus } from "@/types/billing";
import { isPlatformUser } from "@/lib/role-navigation";

export default async function PaymentsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (isPlatformUser(session.user.roles)) redirect("/platform/finanzas");
  if (!session.user.companyId || !session.user.roles.includes("COMPANY_ADMIN"))
    redirect("/forbidden");

  const accessToken = session?.accessToken;
  const billingStatus = await serverApiFetch<BillingStatus>(
    "/billing/status",
    accessToken,
    { allowEmpty: true },
  );

  return <PaymentHistoryClient billingStatus={billingStatus} />;
}
