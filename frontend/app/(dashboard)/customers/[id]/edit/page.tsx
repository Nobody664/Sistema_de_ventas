import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import type { Customer } from "@/types/api";
import { hasEffectivePermission } from "@/types/permissions";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

async function getCustomer(
  id: string,
  accessToken: string | undefined,
): Promise<Customer | null> {
  return serverApiFetch<Customer>(`/customers/${id}`, accessToken);
}

export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!hasEffectivePermission(session.user.roles, "customer:update")) {
    redirect("/forbidden");
  }

  const { id } = await params;
  const customer = await getCustomer(id, accessToken);

  if (!customer) {
    notFound();
  }

  return <CustomerForm customer={customer} />;
}
