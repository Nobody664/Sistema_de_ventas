import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, Package, TrendingUp, Undo2, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { DistributorOperations } from '@/components/distributors/distributor-operations';
import type {
  Distributor,
  DistributorDelivery,
  DistributorProductOption,
  DistributorSale,
} from '@/types/distributors';

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DistributorDetailPage({ params }: DetailPageProps) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const accessToken = session.accessToken;

  const [distributor, products, sales, deliveries] = await Promise.all([
    serverApiFetch<Distributor>(`/distributors/${id}`, accessToken),
    serverApiFetch<DistributorProductOption[]>('/products', accessToken),
    serverApiFetch<DistributorSale[]>(`/distributors/${id}/sales`, accessToken),
    serverApiFetch<DistributorDelivery[]>(`/distributors/${id}/deliveries`, accessToken),
  ]);

  if (!distributor) {
    notFound();
  }

  const balance = distributor.balance;
  const stats = [
    { label: 'Consignado', value: balance?.startingQuantity ?? 0, icon: Package, tone: 'text-blue-600 bg-blue-500/15' },
    { label: 'Vendido', value: balance?.soldQuantity ?? 0, icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-500/15' },
    { label: 'Devuelto', value: balance?.returnedQuantity ?? 0, icon: Undo2, tone: 'text-amber-600 bg-amber-500/15' },
    { label: 'Stock actual', value: balance?.balanceQuantity ?? 0, icon: Package, tone: 'text-orange-600 bg-orange-500/15' },
  ];

  return (
    <div className="space-y-6">
      <Link href="/distributors" className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground">
        <ArrowLeft className="size-4" />
        Volver a distribuidores
      </Link>

      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-amber-600 p-8 text-white">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">{distributor.code}</p>
            <h1 className="mt-3 font-display text-4xl leading-none">{distributor.name}</h1>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/80">
              {distributor.email && (
                <span className="flex items-center gap-2">
                  <Mail className="size-4" />
                  {distributor.email}
                </span>
              )}
              {distributor.phone && (
                <span className="flex items-center gap-2">
                  <Phone className="size-4" />
                  {distributor.phone}
                </span>
              )}
              {distributor.address && (
                <span className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  {distributor.address}
                </span>
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-white/15 px-6 py-4 text-right">
            <p className="flex items-center justify-end gap-2 text-xs uppercase tracking-[0.18em] text-white/60">
              <Wallet className="size-4" />
              Deuda pendiente
            </p>
            <p className="mt-1 font-display text-3xl">S/ {Number(balance?.debtAmount ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="rounded-[30px] bg-white/80 p-6">
              <div className="flex items-center gap-3">
                <div className={`rounded-2xl p-2 ${stat.tone}`}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">{stat.label}</p>
                  <p className="font-display text-3xl">{stat.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Divider label="Operaciones" />
      <DistributorOperations distributor={distributor} products={products ?? []} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[34px] bg-white/85 p-6">
          <h2 className="font-display text-2xl">Ventas registradas</h2>
          <div className="mt-5 space-y-3">
            {(sales?.length ?? 0) > 0 ? (
              sales!.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between rounded-2xl border border-foreground/10 p-4">
                  <div>
                    <p className="font-medium">{sale.saleNumber}</p>
                    <p className="text-sm text-foreground/50">
                      {sale.items?.length ?? 0} ítem(s) · {sale.paymentMethod}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg">S/ {Number(sale.totalAmount).toFixed(2)}</p>
                    <p className="text-xs text-foreground/50">{new Date(sale.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-foreground/50">Sin ventas registradas.</p>
            )}
          </div>
        </Card>

        <Card className="rounded-[34px] bg-white/85 p-6">
          <h2 className="font-display text-2xl">Despachos</h2>
          <div className="mt-5 space-y-3">
            {(deliveries?.length ?? 0) > 0 ? (
              deliveries!.map((delivery) => (
                <div key={delivery.id} className="flex items-center justify-between rounded-2xl border border-foreground/10 p-4">
                  <div>
                    <p className="font-medium">{delivery.deliveryNumber}</p>
                    <p className="text-sm text-foreground/50">
                      {delivery.items?.length ?? 0} producto(s)
                      {delivery.notes ? ` · ${delivery.notes}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground/60">
                    {delivery.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-foreground/50">Sin despachos registrados.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <p className="text-sm uppercase tracking-[0.18em] text-foreground/40">{label}</p>
      <div className="h-px flex-1 bg-foreground/10" />
    </div>
  );
}
