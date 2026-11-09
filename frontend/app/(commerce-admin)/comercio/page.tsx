import { redirect } from "next/navigation";
import { getCommerceSession } from "@/features/store-admin/api/server";
import { commerceEntry } from "@/features/store-admin/api/contracts";

export default async function CommercePage() {
  const { context } = await getCommerceSession();
  redirect(commerceEntry(context));
}
