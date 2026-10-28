import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getServerSession } from "@/lib/session";
import { serverApiFetch } from "@/lib/server-api";
import { hasEffectivePermission } from "@/types/permissions";
import type { Supplier } from "@/types/suppliers";
import type { ProductCatalog } from "@/types/products";
import { PurchaseOrderForm } from "@/components/suppliers/purchase-order-form";

export default async function NewPurchaseOrderPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");
  if (
    !session.user.companyId ||
    !hasEffectivePermission(session.user.roles, "supplier_order:manage")
  )
    redirect("/forbidden");
  const [suppliers, catalog] = await Promise.all([
    serverApiFetch<Supplier[]>("/suppliers?isActive=true", session.accessToken),
    serverApiFetch<ProductCatalog>(
      "/products/catalog?isActive=true&page=1&limit=20",
      session.accessToken,
    ),
  ]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/purchase-orders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a órdenes de compra
      </Link>
      <header>
        <h1 className="font-display text-3xl font-semibold">
          Nueva orden de compra
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Prepara un pedido al proveedor. El inventario se actualiza únicamente
          cuando recibes la mercadería.
        </p>
      </header>
      <PurchaseOrderForm
        suppliers={suppliers ?? []}
        initialCatalog={
          catalog ?? { data: [], total: 0, page: 1, limit: 20, totalPages: 0 }
        }
      />
    </div>
  );
}
