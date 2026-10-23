import { notFound } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import type { Supplier } from "@/types/suppliers";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const supplier = await serverApiFetch<Supplier>(
    `/suppliers/${id}`,
    accessToken,
  );

  if (!supplier) {
    notFound();
  }

  return <SupplierForm supplier={supplier} />;
}
