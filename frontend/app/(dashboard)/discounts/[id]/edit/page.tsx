import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { serverApiFetch } from "@/lib/server-api";
import { DiscountForm } from "@/components/discounts/discount-form";
import type { DiscountCoupon } from "@/types/api";

interface EditDiscountPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDiscountPage({
  params,
}: EditDiscountPageProps) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (!session.user.roles?.includes("COMPANY_ADMIN")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const coupon = await serverApiFetch<DiscountCoupon>(
    `/discounts/${id}`,
    session.accessToken,
  );

  if (!coupon) {
    notFound();
  }

  return <DiscountForm coupon={coupon} />;
}
