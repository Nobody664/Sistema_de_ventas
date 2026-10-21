import Link from "next/link";
import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import { SupplierRow } from "@/components/suppliers/supplier-row";
import type { Supplier } from "@/types/suppliers";
import { Truck, Package, Power } from "lucide-react";

export default async function SuppliersPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const suppliers =
    (await serverApiFetch<Supplier[]>("/suppliers", accessToken)) ?? [];

  const active = suppliers.filter((supplier) => supplier.isActive).length;
  const linkedProducts = suppliers.reduce(
    (acc, supplier) => acc + supplier.products.length,
    0,
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-amber-600 p-6 sm:p-8 text-white animate-fade-in-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/20 p-3">
              <Truck className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-3xl sm:text-4xl">Proveedores</h1>
              <p className="mt-1 text-sm text-white/70">
                Gestiona proveedores y sus productos asociados
              </p>
            </div>
          </div>
          <Link
            href="/suppliers/new"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-2xl bg-white px-6 py-3 text-sm font-medium text-orange-600 transition hover:bg-white/90"
          >
            + Nuevo proveedor
          </Link>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-orange-500/20 p-2">
              <Truck className="size-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Proveedores
              </p>
              <p className="font-display text-3xl">{suppliers.length}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-2">
              <Power className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Activos
              </p>
              <p className="font-display text-3xl">{active}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/20 p-2">
              <Package className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Productos vinculados
              </p>
              <p className="font-display text-3xl">{linkedProducts}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        {suppliers.length > 0 ? (
          <div className="divide-y divide-foreground/10">
            {suppliers.map((supplier) => (
              <SupplierRow key={supplier.id} supplier={supplier} />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-foreground/50">
            Aún no hay proveedores registrados. Crea el primero para asignar
            productos.
          </div>
        )}
      </Card>
    </div>
  );
}
