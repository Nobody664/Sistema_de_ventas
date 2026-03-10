import Link from 'next/link';
import { ArrowRight, Building2, ChartSpline, CreditCard, ShieldCheck, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const plans = [
  { name: 'Start', price: '$19', detail: 'Hasta 3 usuarios y 1 sucursal.' },
  { name: 'Growth', price: '$59', detail: 'Operación completa con reportes y POS.' },
  { name: 'Scale', price: '$149', detail: 'Multi-sucursal, colas y soporte prioritario.' },
];

const faqs = [
  {
    question: '¿Sirve para varias empresas en una sola plataforma?',
    answer: 'Sí. El diseño es multi-tenant y el aislamiento se realiza por empresa.',
  },
  {
    question: '¿Puedo vender con POS y controlar stock?',
    answer: 'Sí. La base contempla productos, inventario, ventas, devoluciones y alertas.',
  },
  {
    question: '¿Soporta Stripe y MercadoPago?',
    answer: 'La arquitectura ya deja listo el módulo de pagos para ambas pasarelas y PayPal.',
  },
];

const featureCards = [
  {
    icon: Building2,
    title: 'Multi-empresa real',
    copy: 'Cada compañía administra su catálogo, personal y ventas con aislamiento claro.',
  },
  {
    icon: CreditCard,
    title: 'Suscripciones y pagos',
    copy: 'Checkout, renovación y webhooks preparados para SaaS de LATAM y global.',
  },
  {
    icon: Store,
    title: 'POS e inventario',
    copy: 'Ventas rápidas, tickets, ajustes de stock y devoluciones con trazabilidad.',
  },
  {
    icon: ShieldCheck,
    title: 'Seguridad aplicada',
    copy: 'JWT, refresh tokens, RBAC, rate limiting y auditoría desde el inicio.',
  },
];

export default function HomePage() {
  return (
    <main className="grain">
      <section className="container relative overflow-hidden py-10 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="space-y-8">
            <span className="eyebrow">SaaS Multi-Empresa para retail moderno</span>
            <div className="space-y-5">
              <h1 className="section-title max-w-4xl">
                Opera varias empresas, sucursales y cajas desde una sola plataforma.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-foreground/72">
                Ventas SaaS combina POS, inventario, suscripciones y control operativo en un stack preparado
                para escalar sin convertir tu panel en un caos.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Entrar al dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/pricing">Ver planes</Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['10k+', 'tickets diarios por tenant'],
                ['<200ms', 'respuesta objetivo cacheada'],
                ['3 pasarelas', 'Stripe, MercadoPago y PayPal'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-3xl border border-foreground/10 bg-white/75 p-4 shadow-halo">
                  <p className="font-display text-3xl font-semibold">{value}</p>
                  <p className="mt-1 text-sm text-foreground/60">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <Card className="overflow-hidden border-foreground/10 bg-[#102030] p-0 text-white shadow-halo">
            <div className="border-b border-white/10 px-6 py-4">
              <p className="font-display text-2xl">Control room</p>
              <p className="text-sm text-white/60">Panel editorial inspirado en herramientas SaaS de alto ritmo.</p>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['MRR', '$28,480'],
                  ['Empresas activas', '186'],
                  ['Ventas hoy', '12,904'],
                  ['Stock crítico', '32'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-white/55">{label}</p>
                    <p className="mt-2 font-display text-3xl">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[28px] border border-dashed border-white/15 bg-gradient-to-br from-white/10 to-white/0 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-white/50">Estrategia</p>
                <p className="mt-3 text-xl leading-8 text-white/85">
                  Shared schema con `tenant_id`, índices compuestos y una ruta híbrida para migrar cuentas
                  enterprise sin rediseñar el dominio.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="container py-8 md:py-14">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((feature) => {
            const Icon = feature.icon;

            return (
            <Card key={feature.title} className="rounded-[30px] bg-white/80 p-6">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-foreground text-background">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-5 font-display text-2xl">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-foreground/65">{feature.copy}</p>
            </Card>
            );
          })}
        </div>
      </section>

      <section className="container py-10 md:py-16">
        <div className="flex items-end justify-between gap-6">
          <div>
            <span className="eyebrow">Planes</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl">Suscripción simple, operación compleja.</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-foreground/62">
            La plataforma fue pensada para trial, activación automática por webhook y expansión progresiva sin
            partir el producto en herramientas separadas.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Card
              key={plan.name}
              className={`rounded-[34px] p-7 ${index === 1 ? 'border-foreground bg-foreground text-white' : 'bg-white/80'}`}
            >
              <p className="text-sm uppercase tracking-[0.18em] opacity-60">{plan.name}</p>
              <p className="mt-5 font-display text-5xl">{plan.price}</p>
              <p className="mt-4 text-sm leading-7 opacity-75">{plan.detail}</p>
              <Button className="mt-8" variant={index === 1 ? 'secondary' : 'default'}>
                Elegir plan
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section className="container py-10 md:py-16">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-[34px] bg-[#173347] p-8 text-white">
            <span className="eyebrow border-white/15 bg-white/10 text-white/70">Testimonios</span>
            <blockquote className="mt-6 font-display text-3xl leading-tight">
              “Pasamos de tres sistemas desconectados a una sola operación multi-sucursal con trazabilidad completa.”
            </blockquote>
            <p className="mt-6 text-sm uppercase tracking-[0.18em] text-white/55">Retail Ops / Lima</p>
          </Card>
          <div className="grid gap-4">
            {faqs.map((faq) => (
              <Card key={faq.question} className="rounded-[28px] bg-white/78 p-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 rounded-full bg-accent/15 p-2 text-accent">
                    <ChartSpline className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-7 text-foreground/65">{faq.answer}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
