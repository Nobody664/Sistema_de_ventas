import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { Building2, UserPlus, ArrowUpCircle, CreditCard, FileText, Activity, Shield, Wallet } from 'lucide-react';

const sections = [
  {
    title: 'Empresas',
    description: 'Gestiona todas las empresas registradas en la plataforma',
    href: '/platform/companies',
    icon: Building2,
    color: 'bg-violet-100 text-violet-700',
  },
  {
    title: 'Suscriptores',
    description: 'Usuarios con suscripción activa o en período de prueba',
    href: '/platform/subscribers',
    icon: UserPlus,
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Solicitudes',
    description: 'Revisa las solicitudes de cambio de plan',
    href: '/platform/upgrade-requests',
    icon: ArrowUpCircle,
    color: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Planes',
    description: 'Administra los planes de suscripción disponibles',
    href: '/platform/plans',
    icon: CreditCard,
    color: 'bg-indigo-100 text-indigo-700',
  },
  {
    title: 'Plantillas de Boletas',
    description: 'Plantillas globales para boletas, tickets y facturas',
    href: '/platform/templates',
    icon: FileText,
    color: 'bg-sky-100 text-sky-700',
  },
  {
    title: 'Pagos globales',
    description: 'Configura Yape, Stripe, MercadoPago y más',
    href: '/platform/settings/payment',
    icon: Wallet,
    color: 'bg-green-100 text-green-700',
  },
  {
    title: 'Auditoría',
    description: 'Registro de actividad de toda la plataforma',
    href: '/platform/audit',
    icon: Activity,
    color: 'bg-slate-100 text-slate-700',
  },
];

export default async function PlatformOverviewPage() {
  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-violet-700 to-indigo-800 p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/10 p-3">
            <Shield className="size-8" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Administración</p>
            <h1 className="mt-1 font-display text-4xl">Panel de la Plataforma</h1>
            <p className="mt-1 text-white/60">
              Dominio separado del tenant: empresas, planes, pagos globales y auditoría.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="group rounded-[30px] bg-white/80 p-6 transition hover:shadow-lg">
                <div className={`inline-flex rounded-2xl p-3 ${section.color}`}>
                  <Icon className="size-6" />
                </div>
                <h3 className="mt-4 font-display text-xl">{section.title}</h3>
                <p className="mt-1 text-sm text-foreground/50">{section.description}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}