import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type {
  Distributor,
  DistributorProductOption,
} from "@/types/distributors";
import { StockExitsClient } from "./stock-exits-client";

export interface StockExitMovement {
  id: string;
  quantity: string;
  notes: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string | null; baseUnit: string };
  distributor: { id: string; name: string; code: string } | null;
}

export default async function StockExitsPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const [distributors, products, exits] = await Promise.all([
    serverApiFetch<Distributor[]>("/distributors", accessToken),
    serverApiFetch<DistributorProductOption[]>("/products", accessToken),
    serverApiFetch<StockExitMovement[]>("/stock-exits", accessToken),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/inventory"
          className="flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a inventario
        </Link>
      </div>

      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-amber-600 p-6 sm:p-8 text-white animate-fade-in-up">
        <p className="text-sm uppercase tracking-[0.18em] text-white/60">
          A quién le vendes / consignas
        </p>
        <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl sm:leading-none">
          Salidas a distribuidores
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
          Registra transferencias de mercadería en consignación. El stock se
          descuenta y se actualiza el saldo del distribuidor automáticamente.
        </p>
      </Card>

      <StockExitsClient
        distributors={distributors ?? []}
        products={products ?? []}
        initialExits={exits ?? []}
      />
    </div>
  );
}
