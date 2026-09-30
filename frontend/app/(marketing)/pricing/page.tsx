'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Zap, Rocket, Crown, Star, ArrowRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { Plan } from '@/types/generated';

const popularPlans = new Set(['GROWTH']);

const comparisonData = [
  { feature: 'Usuarios', free: '1', start: '5', growth: '15', scale: '50+' },
  { feature: 'Productos', free: '50', start: '500', growth: '10,000', scale: 'Ilimitados' },
  { feature: 'Sucursales', free: '1', start: '1', growth: '3', scale: 'Ilimitadas' },
  { feature: 'Reportes', free: 'Básicos', start: 'Básicos', growth: 'Avanzados', scale: 'Avanzados' },
  { feature: 'API/Webhooks', free: false, start: false, growth: true, scale: true },
  { feature: 'Soporte', free: 'Email', start: 'Email', growth: 'Prioritario', scale: 'Dedicado' },
];

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    apiFetch<Plan[]>('/plans')
      .then((data) => {
        if (isMounted) setPlans(data.filter((plan) => plan.isActive));
      })
      .catch(() => {
        if (isMounted) setLoadError('No se pudieron cargar los planes. Inténtalo nuevamente.');
      })
      .finally(() => {
        if (isMounted) setLoadingPlans(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getPlanIcon = (code: string) => {
    switch (code) {
      case 'FREE': return Zap;
      case 'START': return Rocket;
      case 'GROWTH': return Crown;
      case 'SCALE': return Star;
      default: return Zap;
    }
  };

  const getPlanColor = (code: string, popular: boolean) => {
    if (popular) return 'from-violet-600 to-indigo-700';
    switch (code) {
      case 'FREE': return 'from-slate-600 to-slate-700';
      case 'START': return 'from-blue-600 to-indigo-600';
      case 'GROWTH': return 'from-violet-600 to-indigo-700';
      case 'SCALE': return 'from-amber-600 to-orange-700';
      default: return 'from-slate-600 to-slate-700';
    }
  };

  return (
    <main className="container py-14">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="eyebrow">Planes y Precios</span>
        <h1 className="mt-5 font-display text-5xl md:text-6xl">Elige el plan ideal para tu negocio</h1>
        <p className="mt-5 text-lg leading-8 text-foreground/68">
          Comienza gratis y escala cuando tu negocio lo necesite. 
          Sin compromisos, sin sorpresas.
        </p>
      </div>

      {loadingPlans && (
        <div className="flex justify-center py-12" role="status">
          <Loader2 className="size-7 animate-spin text-foreground/50" />
        </div>
      )}
      {loadError && <p className="py-8 text-center text-sm text-red-600" role="alert">{loadError}</p>}

      {!loadingPlans && !loadError && (
      <div className="grid gap-6 lg:grid-cols-4 mb-12">
        {plans.map((plan) => {
          const Icon = getPlanIcon(plan.code);
          const isFree = plan.code === 'FREE';
          const isPopular = popularPlans.has(plan.code);
          const price = Number(plan.billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly);
          const periodLabel = plan.billingCycle === 'YEARLY' ? 'año' : 'mes';
          const features = Array.isArray(plan.features)
            ? plan.features.filter((feature): feature is string => typeof feature === 'string')
            : [];
          
          return (
            <Card
              key={plan.code}
              className={`relative rounded-[34px] overflow-hidden ${
                isPopular
                  ? 'border-2 border-violet-500 shadow-xl shadow-violet-200/50' 
                  : 'border border-foreground/10'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 rounded-b-xl bg-violet-500 px-4 py-1.5 text-sm font-medium text-white">
                  Más popular
                </div>
              )}
              
              <div className={`p-6 ${isPopular ? 'bg-gradient-to-br from-violet-50 to-indigo-50' : 'bg-white'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-2 rounded-lg ${isFree ? 'bg-slate-100' : 'bg-violet-100'}`}>
                    <Icon className={`w-5 h-5 ${isFree ? 'text-slate-600' : 'text-violet-600'}`} />
                  </div>
                  <span className="text-sm uppercase tracking-wider font-medium text-foreground/70">
                    {plan.name}
                  </span>
                </div>
                
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl">S/</span>
                  <span className="font-display text-5xl">{price.toFixed(2)}</span>
                  <span className="text-foreground/50">/{periodLabel}</span>
                </div>
                
                <p className="mt-3 text-sm text-foreground/70">{plan.description}</p>

                <div className="mt-5 space-y-2">
                  {features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-foreground/80">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => {
                    setLoadingPlan(plan.code);
                    router.push(isFree
                      ? '/sign-up?plan=FREE'
                      : `/checkout?plan=${encodeURIComponent(plan.code)}&billingCycle=${plan.billingCycle}`);
                  }}
                  disabled={loadingPlan === plan.code}
                  className={`w-full mt-6 rounded-xl py-3 ${
                    isFree 
                      ? 'bg-slate-800 hover:bg-slate-700 text-white'
                      : isPopular
                        ? 'bg-violet-600 hover:bg-violet-700 text-white'
                        : 'bg-foreground text-white hover:bg-foreground/90'
                  }`}
                >
                  {loadingPlan === plan.code ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {isFree ? 'Crear cuenta gratis' : 'Continuar al pago'}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-12">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Zap className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-display text-xl text-amber-900">¿Empezando?</h3>
            <p className="mt-1 text-amber-800">
              Crea tu cuenta <strong>gratis</strong> y prueba todas las funciones básicas. 
              Cuando necesites más recursos, mejora tu plan en cualquier momento.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-12">
        <h2 className="font-display text-3xl text-center mb-8">Compara los planes</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/10">
                <th className="text-left py-4 px-4 font-medium text-foreground/70">Característica</th>
                <th className="text-center py-4 px-4 font-medium">Free</th>
                <th className="text-center py-4 px-4 font-medium">Start</th>
                <th className="text-center py-4 px-4 font-medium text-violet-700">Growth</th>
                <th className="text-center py-4 px-4 font-medium">Scale</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr key={index} className="border-b border-foreground/5">
                  <td className="py-4 px-4 text-foreground/80">{row.feature}</td>
                  <td className="py-4 px-4 text-center">
                    {typeof row.free === 'boolean' ? (
                      row.free ? <Check className="w-5 h-5 mx-auto text-green-500" /> : <span className="text-foreground/30">—</span>
                    ) : (
                      <span className="font-medium">{row.free}</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {typeof row.start === 'boolean' ? (
                      row.start ? <Check className="w-5 h-5 mx-auto text-green-500" /> : <span className="text-foreground/30">—</span>
                    ) : (
                      <span className="font-medium">{row.start}</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center bg-violet-50/50">
                    {typeof row.growth === 'boolean' ? (
                      row.growth ? <Check className="w-5 h-5 mx-auto text-green-500" /> : <span className="text-foreground/30">—</span>
                    ) : (
                      <span className="font-medium">{row.growth}</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {typeof row.scale === 'boolean' ? (
                      row.scale ? <Check className="w-5 h-5 mx-auto text-green-500" /> : <span className="text-foreground/30">—</span>
                    ) : (
                      <span className="font-medium">{row.scale}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded-3xl p-8 text-center">
        <h3 className="font-display text-2xl">¿Necesitas algo personalizado?</h3>
        <p className="mt-2 text-slate-300 mb-6">
          Contáctanos para planes enterprise con funciones exclusivas.
        </p>
        <Button 
          onClick={() => router.push('/contact')}
          className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl px-8"
        >
          Hablar con ventas
        </Button>
      </div>
    </main>
  );
}
