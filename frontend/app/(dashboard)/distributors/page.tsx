import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { DistributorActions, NewDistributorButton } from '@/components/distributors/distributor-actions';
import type { Distributor } from '@/types/distributors';
import { Handshake, Package, Wallet, Mail, Phone } from 'lucide-react';

export default async function DistributorsPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const distributors = (await serverApiFetch<Distributor[]>('/distributors', accessToken)) ?? [];

  const totalStock = distributors.reduce((acc, d) => acc + (d.balance?.balanceQuantity ?? 0), 0);
  const totalDebt = distributors.reduce((acc, d) => acc + Number(d.balance?.debtAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-amber-600 p-8 text-white animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Canal distribuidores</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Gestión de distribuidores</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Administra el stock consignado, registra ventas, devoluciones, despachos y liquidaciones de cada distribuidor.
            </p>
          </div>
          <div className="hidden sm:block animate-fade-in-up delay-150">
            <NewDistributorButton />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-orange-500/20 p-2">
              <Handshake className="size-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Distribuidores</p>
              <p className="font-display text-3xl">{distributors.length}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6 card-hover">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/20 p-2">
              <Package className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Stock en consigna</p>
              <p className="font-display text-3xl">{totalStock}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6 card-hover">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-2">
              <Wallet className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Deuda total</p>
              <p className="font-display text-3xl">S/ {totalDebt.toFixed(2)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        <div className="grid gap-5 md:grid-cols-2">
          {distributors.length > 0 ? (
            distributors.map((distributor) => (
              <div
                key={distributor.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-foreground/10 p-5 card-hover"
              >
                <Link href={`/distributors/${distributor.id}`} className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{distributor.name}</p>
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-600">
                      {distributor.code}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-foreground/50">
                    {distributor.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {distributor.email}
                      </span>
                    )}
                    {distributor.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" />
                        {distributor.phone}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <span className="text-foreground/50">
                      Stock: <span className="font-medium text-foreground">{distributor.balance?.balanceQuantity ?? 0}</span>
                    </span>
                    <span className="text-foreground/50">
                      Vendido: <span className="font-medium text-foreground">{distributor.balance?.soldQuantity ?? 0}</span>
                    </span>
                    <span className="text-foreground/50">
                      Deuda:{' '}
                      <span className="font-medium text-foreground">
                        S/ {Number(distributor.balance?.debtAmount ?? 0).toFixed(2)}
                      </span>
                    </span>
                  </div>
                </Link>
                <DistributorActions distributor={distributor} />
              </div>
            ))
          ) : (
            <div className="col-span-2 py-8 text-center text-foreground/50">
              Aún no hay distribuidores registrados. Crea el primero para empezar a consignar stock.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
