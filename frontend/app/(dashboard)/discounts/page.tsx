import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { Percent, Tag, TicketPercent } from 'lucide-react';
import {
  DiscountActions,
  DiscountEmptyState,
  NewDiscountButton,
} from '@/components/discounts/discount-actions';
import type { DiscountCoupon } from '@/types/api';

export const dynamic = 'force-dynamic';

interface DiscountListResponse {
  items: DiscountCoupon[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DiscountPageProps {
  searchParams: Promise<{ page?: string }>;
}

type Status = { label: string; className: string };

function getStatus(coupon: DiscountCoupon): Status {
  if (coupon.isActive === false) {
    return { label: 'Desactivado', className: 'bg-slate-100 text-slate-500' };
  }

  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    return { label: 'Programado', className: 'bg-amber-100 text-amber-700' };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) {
    return { label: 'Expirado', className: 'bg-red-100 text-red-600' };
  }
  if (coupon.maxUses != null && (coupon.usedCount ?? 0) >= coupon.maxUses) {
    return { label: 'Agotado', className: 'bg-red-100 text-red-600' };
  }
  return { label: 'Activo', className: 'bg-emerald-100 text-emerald-700' };
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatValue(coupon: DiscountCoupon): string {
  return coupon.type === 'PERCENTAGE'
    ? `-${Number(coupon.value)}%`
    : `-S/ ${Number(coupon.value).toFixed(2)}`;
}

export default async function DiscountsPage({ searchParams }: DiscountPageProps) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes('COMPANY_ADMIN')) {
    redirect('/dashboard');
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);

  const response = await serverApiFetch<DiscountListResponse>(
    page > 1 ? `/discounts?page=${page}` : '/discounts',
    session.accessToken,
  );

  const coupons = response?.items ?? [];
  const total = response?.total ?? 0;
  const totalPages = response?.totalPages ?? 1;
  const activeCount = coupons.filter((coupon) => getStatus(coupon).label === 'Activo').length;

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-600 p-6 sm:p-8 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">
              Descuentos de la empresa
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight break-words sm:text-5xl sm:leading-none">
              Cupones
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Crea códigos de descuento con un cupo de usos, vigencia y compra mínima. Solo
              aplican en ventas y se consumen al confirmar la venta.
            </p>
          </div>
          <NewDiscountButton />
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-white/20 pt-5 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1 font-medium">
            {total} en total
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 font-medium">
            {activeCount} activos en esta página
          </span>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.length > 0 ? (
          coupons.map((coupon) => {
            const status = getStatus(coupon);
            const used = coupon.usedCount ?? 0;
            const maxUses = coupon.maxUses ?? null;
            const hasCap = maxUses != null;
            const progress = hasCap ? Math.min((used / (maxUses || 1)) * 100, 100) : 0;
            const from = formatDate(coupon.startsAt);
            const until = formatDate(coupon.expiresAt);

            return (
              <Card
                key={coupon.id}
                className="group rounded-[30px] bg-white/80 p-6 transition hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <TicketPercent className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-mono text-lg font-semibold tracking-widest truncate">
                        {coupon.code}
                      </h3>
                      <p className="text-sm text-foreground/50 truncate">
                        {coupon.description || 'Sin descripción'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-lg font-bold text-emerald-700">
                    {coupon.type === 'PERCENTAGE' ? (
                      <Percent className="size-4" />
                    ) : (
                      <Tag className="size-4" />
                    )}
                    {formatValue(coupon)}
                  </span>
                  <span className="text-xs text-foreground/50">
                    {coupon.minPurchase != null && Number(coupon.minPurchase) > 0
                      ? `Desde S/ ${Number(coupon.minPurchase).toFixed(2)}`
                      : 'Sin compra mínima'}
                  </span>
                </div>

                <div className="mt-4 border-t border-foreground/10 pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground/60">Usos</span>
                    <span className="font-medium">
                      {hasCap ? `${used} / ${maxUses}` : `${used} · ilimitado`}
                    </span>
                  </div>
                  {hasCap && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}

                  <p className="mt-3 text-xs text-foreground/50">
                    {from || until
                      ? `Vigencia: ${from ?? 'inmediata'}${until ? ` → ${until}` : ' · sin expiración'}`
                      : 'Vigencia: inmediata · sin expiración'}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-end border-t border-foreground/10 pt-4">
                  <DiscountActions coupon={coupon} />
                </div>
              </Card>
            );
          })
        ) : (
          <DiscountEmptyState />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={page > 2 ? `/discounts?page=${page - 1}` : '/discounts'}
              className="rounded-xl border border-foreground/10 px-4 py-2 transition hover:bg-foreground/5"
            >
              Anterior
            </Link>
          ) : (
            <span className="text-foreground/30">Anterior</span>
          )}
          <span className="text-foreground/50">
            Página {page} de {totalPages} · {total} cupones
          </span>
          {page < totalPages ? (
            <Link
              href={`/discounts?page=${page + 1}`}
              className="rounded-xl border border-foreground/10 px-4 py-2 transition hover:bg-foreground/5"
            >
              Siguiente
            </Link>
          ) : (
            <span className="text-foreground/30">Siguiente</span>
          )}
        </div>
      )}
    </div>
  );
}
