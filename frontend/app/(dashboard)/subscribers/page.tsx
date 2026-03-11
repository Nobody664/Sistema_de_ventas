import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Users, Search, CheckCircle, XCircle, Clock, CreditCard, Crown } from 'lucide-react';
import { SubscriberActions } from '@/components/subscribers/subscriber-actions';
import type { SubscriberWithCompany } from '@/types/api';

export default async function SubscribersPage() {
  const session = await auth();
  const accessToken = session?.accessToken;
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto size-12 text-foreground/30" />
          <h2 className="mt-4 font-display text-2xl">Acceso restringido</h2>
          <p className="mt-2 text-foreground/50">No tienes permisos para ver esta página.</p>
        </div>
      </div>
    );
  }

  const subscribers = await serverApiFetch<SubscriberWithCompany[]>('/subscriptions/subscribers', accessToken);

  const statusConfig: Record<string, { color: string; bg: string; icon: typeof Clock; label: string }> = {
    TRIALING: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Clock, label: 'En prueba' },
    ACTIVE: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle, label: 'Activa' },
    PAST_DUE: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock, label: 'Vencida' },
    CANCELED: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Cancelada' },
    EXPIRED: { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: Clock, label: 'Expirada' },
  };

  const planColors: Record<string, string> = {
    START: 'bg-amber-100 text-amber-800',
    GROWTH: 'bg-violet-100 text-violet-800',
    SCALE: 'bg-indigo-100 text-indigo-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl">Suscriptores</h1>
          <p className="mt-1 text-foreground/50">Gestiona las suscripciones y approves nuevos usuarios</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            placeholder="Buscar suscriptores..."
            className="w-full rounded-2xl border border-foreground/10 bg-white py-3 pl-12 pr-4"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {subscribers && subscribers.length > 0 ? (
          subscribers.map((sub) => {
            const status = statusConfig[sub.status] || statusConfig.TRIALING;
            const StatusIcon = status.icon;
            const planColor = planColors[sub.plan?.code || 'START'];
            return (
              <Card key={sub.id} className="group rounded-[30px] bg-white/80 p-6 transition hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600">
                      {sub.company?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="font-display text-xl">{sub.company?.name}</h3>
                      <p className="text-sm text-foreground/50">{sub.company?.email || 'Sin email'}</p>
                    </div>
                  </div>
                  <SubscriberActions subscriber={sub} />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${status.bg}`}>
                    <StatusIcon className={`size-4 ${status.color}`} />
                    <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
                  </div>
                  {sub.plan && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${planColor}`}>
                      <Crown className="size-3" />
                      {sub.plan.name}
                    </span>
                  )}
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-foreground/60">
                    <CreditCard className="size-4" />
                    <span>
                      {sub.billingCycle === 'MONTHLY' ? 'Mensual' : 'Anual'} - S/ {sub.billingCycle === 'MONTHLY' ? Number(sub.plan?.priceMonthly) : Number(sub.plan?.priceYearly)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground/60">
                    <Clock className="size-4" />
                    <span>
                      Inicio: {new Date(sub.startDate).toLocaleDateString('es-PE')}
                      {sub.endDate && ` - Fin: ${new Date(sub.endDate).toLocaleDateString('es-PE')}`}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-foreground/10 pt-4">
                  <div className="text-center">
                    <p className="font-display text-lg">{sub.company?.status}</p>
                    <p className="text-xs text-foreground/50">Empresa</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-lg">{sub.autoRenew ? 'Sí' : 'No'}</p>
                    <p className="text-xs text-foreground/50">Renovación</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-lg">{sub.payments?.length || 0}</p>
                    <p className="text-xs text-foreground/50">Pagos</p>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="col-span-3 flex flex-col items-center justify-center py-16">
            <Users className="size-16 text-foreground/20" />
            <h3 className="mt-4 font-display text-xl">No hay suscriptores</h3>
            <p className="mt-1 text-foreground/50">Los suscriptores aparecerán aquí cuando se registren.</p>
          </div>
        )}
      </div>
    </div>
  );
}
