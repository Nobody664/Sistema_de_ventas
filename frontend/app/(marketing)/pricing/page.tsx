'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Loader2, Check } from 'lucide-react';

const plans = [
  {
    code: 'START',
    name: 'Start',
    price: 19,
    priceYearly: 190,
    description: 'Para comercios que necesitan salir rápido.',
    features: ['3 usuarios', '500 productos', '1 sucursal', 'Soporte básico'],
    popular: false,
  },
  {
    code: 'GROWTH',
    name: 'Growth',
    price: 59,
    priceYearly: 590,
    description: 'Para empresas con equipo, inventario y reportes.',
    features: ['15 usuarios', '10,000 productos', '3 sucursales', 'Reportes avanzados', 'Webhooks/API'],
    popular: true,
  },
  {
    code: 'SCALE',
    name: 'Scale',
    price: 149,
    priceYearly: 1490,
    description: 'Para operaciones con varias sedes y automatización.',
    features: ['Usuarios ilimitados', 'Productos ilimitados', 'Sucursales ilimitadas', 'Todo en Growth', 'Soporte prioritario'],
    popular: false,
  },
];

const pricingRows = [
  ['Usuarios', '3', '15', 'Ilimitados'],
  ['Productos', '500', '10,000', 'Ilimitados'],
  ['Sucursales', '1', '3', 'Ilimitadas'],
  ['Reportes avanzados', 'No', 'Sí', 'Sí'],
  ['Webhooks/API', 'No', 'Sí', 'Sí'],
];

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planCode: string, provider: string) => {
    setLoadingPlan(planCode);
    
    // Check if user is logged in
    const response = await fetch('/api/auth/session');
    const session = await response.json();

    if (!session?.user) {
      router.push('/sign-in?callbackUrl=/pricing');
      return;
    }

    // Redirect to checkout
    router.push(`/checkout?plan=${planCode}&provider=${provider}`);
  };

  return (
    <main className="container py-14">
      <span className="eyebrow">Pricing matrix</span>
      <h1 className="mt-5 font-display text-5xl md:text-6xl">Planes listos para operar desde el día uno.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-foreground/68">
        El cobro recurrente debe ser tan serio como el POS. Aceptamos Yape, MercadoPago, Stripe y PayPal.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.code}
            className={`relative rounded-[34px] p-8 ${
              plan.popular ? 'border-2 border-violet-500 bg-violet-950 text-white' : 'bg-white/80'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-4 py-1 text-sm font-medium text-white">
                Más popular
              </div>
            )}
            <p className={`text-sm uppercase tracking-[0.18em] ${plan.popular ? 'text-violet-300' : 'opacity-60'}`}>
              {plan.name}
            </p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-6xl">S/</span>
              <span className="font-display text-6xl">{plan.price}</span>
              <span className={`text-lg ${plan.popular ? 'text-violet-300' : 'text-foreground/50'}`}>/mes</span>
            </div>
            <p className={`mt-4 text-sm leading-7 ${plan.popular ? 'text-violet-200' : 'opacity-70'}`}>
              {plan.description}
            </p>

            <div className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <svg
                    className={`h-4 w-4 ${plan.popular ? 'text-violet-400' : 'text-green-500'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className={plan.popular ? 'text-violet-100' : ''}>{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-3">
              <button
                onClick={() => handleSubscribe(plan.code, 'yape')}
                disabled={loadingPlan === plan.code}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-medium transition ${
                  plan.popular
                    ? 'bg-white text-violet-900 hover:bg-violet-50'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
                }`}
              >
                {loadingPlan === plan.code ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/>
                    </svg>
                    Pagar con Yape
                  </>
                )}
              </button>
              <button
                onClick={() => handleSubscribe(plan.code, 'mercadopago')}
                disabled={loadingPlan === plan.code}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-6 py-4 text-sm font-medium transition ${
                  plan.popular
                    ? 'border-violet-400 text-white hover:bg-violet-800'
                    : 'border-foreground/20 hover:bg-foreground/5'
                }`}
              >
                {loadingPlan === plan.code ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'MercadoPago'
                )}
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-10 overflow-hidden rounded-[34px] p-0">
        <div className="grid grid-cols-4 gap-px bg-border text-sm">
          {['Característica', 'Start', 'Growth', 'Scale', ...pricingRows.flat()].map((cell, index) => (
            <div
              key={`${cell}-${index}`}
              className={`bg-white px-5 py-4 ${index < 4 ? 'font-semibold text-foreground' : 'text-foreground/70'}`}
            >
              {cell}
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
