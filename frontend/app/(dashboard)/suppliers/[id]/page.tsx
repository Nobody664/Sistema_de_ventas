import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Mail, Phone, MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import { SupplierProductsManager } from "@/components/suppliers/supplier-products-manager";
import type { Supplier } from "@/types/suppliers";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  baseUnit: string;
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const [supplier, products] = await Promise.all([
    serverApiFetch<Supplier>(`/suppliers/${id}`, accessToken),
    serverApiFetch<ProductOption[]>("/products?limit=500", accessToken),
  ]);

  if (!supplier) {
    notFound();
  }

  const productOptions = Array.isArray(products) ? products : [];

  return (
    <div className="space-y-6">
      <Link
        href="/suppliers"
        className="flex items-center gap-2 text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a proveedores
      </Link>

      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-amber-600 p-6 sm:p-8 text-white animate-fade-in-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">
              {supplier.name}
            </h1>
            {supplier.code && (
              <p className="mt-1 text-sm text-white/70">
                Código {supplier.code}
              </p>
            )}
          </div>
          <Link
            href={`/suppliers/${supplier.id}/edit`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-orange-600 transition hover:bg-white/90"
          >
            <Pencil className="size-4" />
            Editar
          </Link>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="space-y-4 rounded-[30px] bg-white/85 p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">
            Datos de contacto
          </p>
          <div className="space-y-3 text-sm">
            {supplier.contactName && (
              <p className="font-medium">{supplier.contactName}</p>
            )}
            {supplier.email && (
              <p className="flex items-center gap-2 text-foreground/60">
                <Mail className="size-4 shrink-0" />
                {supplier.email}
              </p>
            )}
            {supplier.phone && (
              <p className="flex items-center gap-2 text-foreground/60">
                <Phone className="size-4 shrink-0" />
                {supplier.phone}
              </p>
            )}
            {supplier.address && (
              <p className="flex items-center gap-2 text-foreground/60">
                <MapPin className="size-4 shrink-0" />
                {supplier.address}
              </p>
            )}
            {supplier.leadTimeDays !== null && (
              <p className="flex items-center gap-2 text-foreground/60">
                <Clock className="size-4 shrink-0" />
                Entrega en {supplier.leadTimeDays} días
              </p>
            )}
          </div>
          {supplier.brands.length > 0 && (
            <div className="border-t border-foreground/10 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">
                Marcas
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {supplier.brands.map((brand) => (
                  <span
                    key={brand}
                    className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-600"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          )}
          {supplier.notes && (
            <div className="border-t border-foreground/10 pt-4 text-sm text-foreground/60">
              {supplier.notes}
            </div>
          )}
        </Card>

        <SupplierProductsManager
          supplier={supplier}
          productOptions={productOptions}
        />
      </div>
    </div>
  );
}
