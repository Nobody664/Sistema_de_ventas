'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowUpCircle,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

const platformMainItems = [
  { label: 'Resumen', href: '/platform', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Empresas', href: '/platform/companies', icon: Building2, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Suscriptores', href: '/platform/subscribers', icon: UserPlus, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Solicitudes', href: '/platform/upgrade-requests', icon: ArrowUpCircle, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Planes', href: '/platform/plans', icon: CreditCard, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
];

const platformAdminItems = [
  { label: 'Plantillas de Boletas', href: '/platform/templates', icon: FileText, roles: ['SUPER_ADMIN'] },
  { label: 'Pagos globales', href: '/platform/settings/payment', icon: CreditCard, roles: ['SUPER_ADMIN'] },
  { label: 'Auditoría', href: '/platform/audit', icon: Activity, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
];

type PlatformSidebarProps = {
  roles: string[];
};

export function PlatformSidebar({ roles }: PlatformSidebarProps) {
  const pathname = usePathname();

  const visibleMain = platformMainItems.filter((item) => item.roles.some((role) => roles.includes(role)));
  const visibleAdmin = platformAdminItems.filter((item) => item.roles.some((role) => roles.includes(role)));

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-sidebar-muted/50 bg-sidebar px-4 py-6 lg:flex lg:w-64 shrink-0">
      <div className="flex min-h-0 flex-col gap-6 overflow-hidden">
        <div className="rounded-2xl border border-sidebar-muted/30 bg-sidebar-muted/30 p-4 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-sidebar-foreground/40">Ventas SaaS</p>
          <p className="mt-2 font-display text-2xl text-sidebar-foreground">Control</p>
          <p className="mt-1 text-xs font-medium text-violet-400">Plataforma</p>
        </div>

        <nav className="space-y-1 overflow-y-auto py-1">
          <p className="px-4 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/30">Plataforma</p>
          {visibleMain.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-violet-500/15 text-violet-400'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground'
                }`}
              >
                <Icon className={`size-4 ${active ? 'text-violet-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {visibleAdmin.length > 0 && (
          <nav className="space-y-1 overflow-y-auto py-1">
            <p className="px-4 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/30">Sistema</p>
            {visibleAdmin.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-violet-500/15 text-violet-400'
                      : 'text-sidebar-foreground/60 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground'
                  }`}
                >
                  <Icon className={`size-4 ${active ? 'text-violet-400' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      <div className="rounded-xl border border-sidebar-muted/30 bg-sidebar-muted/30 p-4 shrink-0">
        <p className="flex items-center gap-2 text-xs text-sidebar-foreground/40">
          <ShieldCheck className="size-4 text-violet-400" />
          Acceso de administrador
        </p>
        <p className="mt-1 text-sm text-sidebar-foreground/60">Tu sesión tiene permisos de plataforma</p>
      </div>
    </aside>
  );
}