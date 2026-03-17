'use client';

import Link from 'next/link';
import { ArrowRight, Zap, Users, CreditCard, BarChart3, Check, Rocket, Crown, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AnimatedSection, AnimatedCard, HoverCard } from '@/components/ui/animations';

const benefits = [
  {
    icon: Zap,
    title: 'Implementación en minutos',
    description: 'Comienza a operar inmediatamente. Sin infraestructura, sin complicaciones.',
  },
  {
    icon: Users,
    title: 'Gestión de equipos',
    description: 'Administra empleados, roles y permisos desde una sola plataforma.',
  },
  {
    icon: CreditCard,
    title: 'Pagos integrados',
    description: 'Acepta efectivo, tarjetas y pagos digitales con facilidad.',
  },
  {
    icon: BarChart3,
    title: 'Reportes en tiempo real',
    description: 'Toma decisiones informadas con dashboards actualizados al instante.',
  },
];

const testimonials = [
  {
    name: 'María González',
    company: 'Tienda Tech',
    comment: 'Increíble transformación. Duplicamos nuestras ventas en 3 meses.',
    rating: 5,
  },
  {
    name: 'Carlos Mendoza',
    company: 'Fashion Store',
    comment: 'El mejor POS que hemos usado. Simple, rápido y confiable.',
    rating: 5,
  },
  {
    name: 'Ana López',
    company: 'Supermercado Local',
    description: 'Desde que usamos Ventas SaaS, nuestro control de inventario es perfecto.',
    rating: 5,
  },
];

const plans = [
  {
    name: 'Starter',
    price: 'S/99',
    period: '/mes',
    description: 'Ideal para negocios pequeños',
    features: ['1 usuario', 'Productos ilimitados', 'Reportes básicos', 'Soporte por email'],
    icon: Rocket,
    color: 'from-blue-500 to-cyan-500',
    popular: false,
  },
  {
    name: 'Professional',
    price: 'S/199',
    period: '/mes',
    description: 'Para negocios en crecimiento',
    features: ['5 usuarios', 'Productos ilimitados', 'Reportes avanzados', 'Soporte prioritario', 'Multi-caja', 'Exportación Excel'],
    icon: Crown,
    color: 'from-violet-500 to-purple-600',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'S/399',
    period: '/mes',
    description: 'Solución completa',
    features: ['Usuarios ilimitados', 'Productos ilimitados', 'Reportes personalizados', 'Soporte 24/7', 'API Access', 'Integraciones', 'Multi-sucursal'],
    icon: Star,
    color: 'from-amber-600 to-orange-600',
    popular: false,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-black py-28">
        {/* Animated background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        
        <div className="container relative z-10">
          <AnimatedSection>
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Nueva versión disponible
              </div>
              <h1 className="font-display text-5xl font-medium leading-tight text-white md:text-7xl">
                Gestiona tu negocio{' '}
                <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                  sin complicaciones
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50">
                La plataforma de ventas todo-en-uno para emprendedores peruanos. 
                Controla inventario, ventas y clientes desde cualquier lugar.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-8 text-white hover:from-violet-700 hover:to-blue-700 shadow-lg shadow-violet-500/25">
                  <Link href="/sign-up">
                    Empezar gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-12 rounded-xl px-8 text-white/70 hover:text-white">
                  <Link href="/pricing">Ver planes</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-white/30">
                No se requiere tarjeta de crédito • Setup en 5 minutos
              </p>
            </div>
          </AnimatedSection>

          {/* Dashboard Preview */}
          <AnimatedSection delay={200}>
            <div className="mt-20">
              <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a1628] shadow-2xl shadow-violet-500/10 hover:shadow-violet-500/20 transition-shadow duration-500">
                <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
                  <div className="size-3 rounded-full bg-red-500" />
                  <div className="size-3 rounded-full bg-yellow-500" />
                  <div className="size-3 rounded-full bg-green-500" />
                </div>
                <div className="grid grid-cols-4 gap-0">
                  <div className="col-span-1 border-r border-white/5 bg-white/5 p-4">
                    <div className="h-4 w-24 rounded bg-white/10" />
                    <div className="mt-6 space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-8 rounded bg-white/5" />
                      ))}
                    </div>
                  </div>
                  <div className="col-span-3 p-6">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        ['Ventas hoy', 'S/ 12,450'],
                        ['Tickets', '156'],
                        ['Clientes nuevos', '23'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-white/5 p-4">
                          <p className="text-xs text-white/40">{label}</p>
                          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-xl bg-white/5 p-4">
                      <p className="text-xs text-white/40 mb-4">Últimas transacciones</p>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-white/10" />
                            <div>
                              <p className="text-sm text-white">Cliente #{1000 + i}</p>
                              <p className="text-xs text-white/40">Hace {i * 5} minutos</p>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-emerald-400">+S/ {([245.89, 189.50, 312.75, 98.20][i - 1]).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-white" />
        <div className="absolute top-20 left-0 w-96 h-96 bg-violet-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-20 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50" />
        
        <div className="container relative">
          <AnimatedSection>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-4xl font-medium md:text-5xl text-slate-900">
                Todo lo que necesitas para vender más y mejor
              </h2>
              <p className="mt-4 text-lg text-slate-500">
                Herramientas profesionales diseñadas para emprendedores peruanos
              </p>
            </div>
          </AnimatedSection>
          
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <AnimatedCard key={benefit.title} delay={100 * index}>
                  <HoverCard>
                    <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl">
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 text-white shadow-lg shadow-violet-500/25">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">{benefit.title}</h3>
                      <p className="mt-2 text-slate-500">{benefit.description}</p>
                    </div>
                  </HoverCard>
                </AnimatedCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-slate-50 py-28">
        <div className="container">
          <AnimatedSection>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-4xl font-medium text-slate-900">
                Lo que dicen nuestros clientes
              </h2>
            </div>
          </AnimatedSection>
          
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <AnimatedCard key={testimonial.name} delay={100 * index}>
                <div className="rounded-2xl bg-white p-6 shadow-lg">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-600">"{testimonial.comment || testimonial.description}"</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white font-bold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{testimonial.name}</p>
                      <p className="text-sm text-slate-500">{testimonial.company}</p>
                    </div>
                  </div>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-black py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[80px]" />
        
        <div className="container relative">
          <AnimatedSection>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-4xl font-medium text-white md:text-5xl">
                Planes que se adaptan a tu negocio
              </h2>
              <p className="mt-4 text-lg text-white/50">
                Elige el plan ideal para tus necesidades
              </p>
            </div>
          </AnimatedSection>
          
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {plans.map((plan, index) => {
              const Icon = plan.icon;
              return (
                <AnimatedCard key={plan.name} delay={100 * index}>
                  <div className={`relative rounded-2xl border ${plan.popular ? 'border-violet-500/50 bg-white/5' : 'border-white/10 bg-white/5'} p-8 backdrop-blur-sm transition-all hover:border-violet-500/70`}>
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-1 text-xs font-semibold text-white">
                        Más popular
                      </div>
                    )}
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${plan.color} text-white shadow-lg mb-6`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                    <p className="mt-2 text-sm text-white/50">{plan.description}</p>
                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-white/50">{plan.period}</span>
                    </div>
                    <ul className="mt-8 space-y-4">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-white/70">
                          <Check className="h-5 w-5 text-emerald-400" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button asChild className={`mt-8 h-12 w-full rounded-xl ${plan.popular ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                      <Link href="/sign-up">Comenzar ahora</Link>
                    </Button>
                  </div>
                </AnimatedCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-violet-600 to-blue-600 py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
        
        <div className="container relative">
          <AnimatedSection>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold text-white md:text-4xl">
                ¿Listo para transformar tu negocio?
              </h2>
              <p className="mt-4 text-lg text-white/80">
                Únete a miles de emprendedores que ya están vendiendo más con Ventas SaaS
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-xl bg-white text-violet-600 px-8 font-semibold hover:bg-white/90">
                  <Link href="/sign-up">
                    Crear cuenta gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-12 rounded-xl px-8 text-white hover:bg-white/10">
                  <Link href="/contact">Hablar con ventas</Link>
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/10 py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 text-white font-bold">
                V
              </div>
              <span className="text-lg font-medium text-white">Ventas SaaS</span>
            </div>
            <p className="text-sm text-white/40">
              © 2026 Ventas SaaS. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
