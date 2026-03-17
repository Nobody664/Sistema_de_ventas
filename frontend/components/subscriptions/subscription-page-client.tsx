'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Check, CreditCard, Calendar, AlertCircle, Loader2, Crown, Zap, Rocket } from 'lucide-react';

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  billingCycle: string;
  maxUsers: number | null;
  maxProducts: number | null;
  features: string[] | Record<string, unknown>;
  isActive: boolean;
}

interface Subscription {
  id: string;
  status: string;
  billingCycle: string;
  startDate: string;
  endDate: string | null;
  plan?: Plan;
  payments?: Array<{
    id: string;
    amount: string;
    status: string;
    createdAt: string;
  }>;
}

interface PlanUpgradeRequest {
  id: string;
  status: string;
  currentPlan: { code: string; name: string };
  newPlan: { code: string; name: string };
}

interface SubscriptionPageClientProps {
  initialSubscription?: Subscription | null | undefined;
  initialPlans: Plan[];
  pendingUpgrade?: PlanUpgradeRequest | null;
}

export function SubscriptionPageClient({ initialSubscription, initialPlans, pendingUpgrade }: SubscriptionPageClientProps) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(initialSubscription ?? null);
  const [plans] = useState<Plan[]>(initialPlans);

  const isTrialing = subscription?.status === 'TRIALING';
  const isActive = subscription?.status === 'ACTIVE';
  const currentPlanCode = subscription?.plan?.code || 'FREE';
  const currentPlanName = subscription?.plan?.name || 'Free';

  const PLAN_ORDER = ['FREE', 'START', 'GROWTH', 'SCALE'];
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlanCode);
  const nextPlans = PLAN_ORDER.slice(currentPlanIndex + 1);
  
  const availablePlans = plans.filter(p => 
    p.code !== 'FREE' && 
    p.isActive && 
    nextPlans.includes(p.code)
  );

  const hasPendingUpgrade = !!pendingUpgrade;

  const handleUpgrade = (planCode: string) => {
    router.push(`/checkout?plan=${planCode}&upgrade=true`);
  };

  const getPlanIcon = (code: string) => {
    switch (code) {
      case 'FREE':
        return <Zap className="size-5" />;
      case 'START':
        return <Rocket className="size-5" />;
      case 'GROWTH':
        return <Crown className="size-5" />;
      case 'SCALE':
        return <Crown className="size-5" />;
      default:
        return <Crown className="size-5" />;
    }
  };

  const getPlanColor = (code: string) => {
    switch (code) {
      case 'FREE':
        return 'from-gray-500 to-slate-600';
      case 'START':
        return 'from-blue-500 to-indigo-600';
      case 'GROWTH':
        return 'from-violet-500 to-purple-600';
      case 'SCALE':
        return 'from-amber-500 to-orange-600';
      default:
        return 'from-violet-500 to-purple-600';
    }
  };

  const parseFeatures = (features: string[] | Record<string, unknown>): string[] => {
    if (Array.isArray(features)) {
      return features;
    }
    return [];
  };

  const daysRemaining = subscription?.endDate
    ? Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/10 p-3">
            <CreditCard className="size-8" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Tu suscripción</p>
            <h1 className="mt-1 font-display text-4xl">Mi Plan</h1>
            <p className="mt-1 text-white/60">Gestiona tu suscripción y planes</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[30px] bg-white/85 p-6">
          <h2 className="font-display text-xl">Plan Actual</h2>
          <p className="mt-1 text-foreground/60">Estás usando actualmente</p>

          <div className="mt-6 flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${getPlanColor(currentPlanCode)} text-white`}>
              {getPlanIcon(currentPlanCode)}
            </div>
            <div>
              <h3 className="font-display text-2xl">{currentPlanName}</h3>
              <div className="flex items-center gap-2">
                {isTrialing && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Prueba gratuita
                  </span>
                )}
                {isActive && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Activo
                  </span>
                )}
              </div>
            </div>
          </div>

          {isTrialing && daysRemaining > 0 && (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4">
              <AlertCircle className="size-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Período de prueba</p>
                <p className="text-sm text-amber-700">
                  Te quedan <strong>{daysRemaining} días</strong> de prueba gratuita
                </p>
              </div>
            </div>
          )}

          {subscription?.startDate && (
            <div className="mt-4 flex items-center gap-2 text-sm text-foreground/60">
              <Calendar className="size-4" />
              <span>Iniciado el {new Date(subscription.startDate).toLocaleDateString('es-PE')}</span>
            </div>
          )}

          {subscription?.endDate && (
            <div className="mt-2 flex items-center gap-2 text-sm text-foreground/60">
              <Calendar className="size-4" />
              <span>
                {isTrialing ? 'Termina el' : 'Próximo cobro'} {new Date(subscription.endDate).toLocaleDateString('es-PE')}
              </span>
            </div>
          )}

          <div className="mt-6 border-t border-foreground/10 pt-4">
            <p className="text-sm font-medium text-foreground/70">Características incluidas:</p>
            <ul className="mt-3 space-y-2">
              {subscription?.plan && parseFeatures(subscription.plan.features).map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-green-600" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/85 p-6">
          {hasPendingUpgrade ? (
            <>
              <h2 className="font-display text-xl">Cambio de Plan en Proceso</h2>
              <p className="mt-1 text-foreground/60">Tu solicitud está siendo procesada</p>
              
              <div className="mt-6 rounded-xl bg-amber-50 p-4 border border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">
                      Esperando confirmación de cambio de plan
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      De <strong>{pendingUpgrade?.currentPlan.name}</strong> a <strong>{pendingUpgrade?.newPlan.name}</strong>
                    </p>
                    <p className="text-xs text-amber-600 mt-2">
                      Si aún no tienes respuesta, comunícate con soporte.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : availablePlans.length > 0 ? (
            <>
              <h2 className="font-display text-xl">Mejora tu Plan</h2>
              <p className="mt-1 text-foreground/60">Desbloquea más funciones</p>

              <div className="mt-6 space-y-4">
                {availablePlans.map((plan) => {
                  const isCurrentPlan = plan.code === currentPlanCode;
                  const price = parseFloat(plan.priceMonthly);

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-2xl border-2 p-4 transition ${
                        isCurrentPlan
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-foreground/10 hover:border-violet-300'
                      }`}
                    >
                      {isCurrentPlan && (
                        <span className="absolute -top-2 right-4 rounded-full bg-violet-500 px-3 py-0.5 text-xs font-medium text-white">
                          Actual
                        </span>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${getPlanColor(plan.code)} text-white`}>
                        {getPlanIcon(plan.code)}
                      </div>
                      <div>
                        <h3 className="font-medium">{plan.name}</h3>
                        <p className="text-xs text-foreground/50">
                          {plan.maxUsers ? `${plan.maxUsers} usuarios` : 'Usuarios ilimitados'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-display text-xl">
                        {price === 0 ? 'Gratis' : `S/ ${price}`}
                      </p>
                      {price > 0 && (
                        <p className="text-xs text-foreground/50">/mes</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {parseFeatures(plan.features).slice(0, 3).map((feature, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-foreground/70"
                      >
                        {feature}
                      </span>
                    ))}
                    {parseFeatures(plan.features).length > 3 && (
                      <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-foreground/50">
                        +{parseFeatures(plan.features).length - 3} más
                      </span>
                    )}
                  </div>

                  {!isCurrentPlan && (
                    <Button
                      onClick={() => handleUpgrade(plan.code)}
                      className="mt-4 w-full"
                      variant={isCurrentPlan ? 'outline' : 'default'}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : price === 0 ? (
                        'Cambiar a Gratis'
                      ) : (
                        'Mejorar Plan'
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </>
          ) : (
            <div className="mt-6 text-center py-8">
              <Crown className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-foreground/60">
                ¡Tienes el plan más alto disponible!
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
