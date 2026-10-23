import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { DiscountForm } from "@/components/discounts/discount-form";

export default async function NewDiscountPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (!session.user.roles?.includes("COMPANY_ADMIN")) {
    redirect("/dashboard");
  }

  return <DiscountForm />;
}
