import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { serverApiFetch } from "@/lib/server-api";
import type { ExpiryBatchList } from "@/lib/batch-expiry";
import { ExpiredBatchesClient } from "./expired-batches-client";

export default async function ExpiredBatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const session = await getServerSession();
  if (
    !session?.user?.companyId ||
    !session.user.roles.some((role) =>
      ["COMPANY_ADMIN", "MANAGER"].includes(role),
    )
  )
    redirect("/forbidden");
  const params = await searchParams;
  const productId =
    typeof params.productId === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(params.productId)
      ? params.productId
      : "";
  const initial = await serverApiFetch<ExpiryBatchList>(
    `/batch-expiry${productId ? `?productId=${encodeURIComponent(productId)}` : ""}`,
    session.accessToken,
  );
  if (!initial)
    return (
      <div role="alert" className="rounded-2xl border border-foreground/15 p-6">
        <h1 className="font-display text-2xl">
          No se pudieron cargar los lotes
        </h1>
        <a href="/expired-batches" className="mt-3 inline-block underline">
          Volver a cargar
        </a>
      </div>
    );
  return (
    <ExpiredBatchesClient
      initial={initial}
      initialProductId={productId}
      canViewFinance={session.user.roles.includes("COMPANY_ADMIN")}
    />
  );
}
