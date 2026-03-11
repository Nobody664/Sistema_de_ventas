import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Settings, User, Building2, CreditCard, Bell, Shield } from 'lucide-react';
import Link from 'next/link';

type Subscription = {
  status: string;
  provider: string;
  billingCycle: string;
  plan?: { name: string; priceMonthly: string };
};

type Company = {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  status: string;
};

export default async function ProfilePage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  const [subscription, company] = await Promise.all([
    serverApiFetch<Subscription>('/subscriptions/current', accessToken),
    serverApiFetch<Company>('/companies/current', accessToken),
  ]);

  const fullName = session?.user?.name ?? session?.user?.email ?? 'Usuario';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const menuItems = [
    { label: 'Información personal', icon: User, href: '#personal', description: 'Nombre, email y datos de contacto' },
    { label: 'Empresa', icon: Building2, href: '#company', description: 'Datos de la empresa' },
    { label: 'Suscripción', icon: CreditCard, href: '#subscription', description: 'Plan y facturación' },
    { label: 'Notificaciones', icon: Bell, href: '#notifications', description: 'Preferencias de alertas' },
    { label: 'Seguridad', icon: Shield, href: '#security', description: 'Contraseña y autenticación' },
    { label: 'Configuración', icon: Settings, href: '#settings', description: 'Preferencias generales' },
  ];

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-white">
        <div className="flex items-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-4xl font-medium">
            {initials}
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Perfil de usuario</p>
            <h1 className="mt-2 font-display text-4xl">{fullName}</h1>
            <p className="mt-1 text-white/60">{session?.user?.email}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <Card className="rounded-[30px] bg-white/80 p-4">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-foreground/72 transition hover:bg-foreground/5 hover:text-foreground"
                >
                  <Icon className="size-5" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[30px] bg-white/85 p-6" id="personal">
            <h2 className="font-display text-2xl">Información personal</h2>
            <p className="mt-1 text-foreground/50">Gestiona tu información de contacto</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre completo</label>
                <input
                  type="text"
                  defaultValue={fullName}
                  className="w-full rounded-2xl border border-foreground/10 bg-background px-4 py-3"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  defaultValue={session?.user?.email ?? ''}
                  className="w-full rounded-2xl border border-foreground/10 bg-background px-4 py-3"
                />
              </div>
            </div>
            <button className="mt-6 rounded-2xl bg-slate-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700">
              Guardar cambios
            </button>
          </Card>

          <Card className="rounded-[30px] bg-white/85 p-6" id="company">
            <h2 className="font-display text-2xl">Empresa</h2>
            <p className="mt-1 text-foreground/50">Información de tu organización</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre de empresa</label>
                <input
                  type="text"
                  defaultValue={company?.name ?? 'No asignada'}
                  className="w-full rounded-2xl border border-foreground/10 bg-background px-4 py-3"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <input
                  type="text"
                  defaultValue={company?.slug ?? '-'}
                  className="w-full rounded-2xl border border-foreground/10 bg-background px-4 py-3"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Teléfono</label>
                <input
                  type="tel"
                  defaultValue={company?.phone ?? ''}
                  className="w-full rounded-2xl border border-foreground/10 bg-background px-4 py-3"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Estado</label>
                <div className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-background px-4 py-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      company?.status === 'ACTIVE' ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                  />
                  {company?.status ?? 'Sin empresa'}
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] bg-white/85 p-6" id="subscription">
            <h2 className="font-display text-2xl">Suscripción</h2>
            <p className="mt-1 text-foreground/50">Plan y método de pago</p>
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-foreground/10 p-4">
              <div>
                <p className="font-medium">{subscription?.plan?.name ?? 'Plan actual'}</p>
                <p className="text-sm text-foreground/50">
                  {subscription?.billingCycle ?? 'Mensual'} · S/ {subscription?.plan?.priceMonthly ?? '0'}/mes
                </p>
              </div>
              <Link
                href="/subscriptions"
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Cambiar plan
              </Link>
            </div>
          </Card>

          <Card className="rounded-[30px] bg-white/85 p-6" id="security">
            <h2 className="font-display text-2xl">Seguridad</h2>
            <p className="mt-1 text-foreground/50">Gestiona tu contraseña y autenticación</p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-foreground/10 p-4">
                <div>
                  <p className="font-medium">Contraseña</p>
                  <p className="text-sm text-foreground/50">Último cambio: hace 30 días</p>
                </div>
                <button className="rounded-xl border border-foreground/20 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5">
                  Cambiar
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
