'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Bell, Building2, CreditCard, LayoutDashboard, Package, ShoppingCart, Users, Activity, UserCog, FolderTree, UserPlus, ArrowUpCircle, FileText } from 'lucide-react';

const mainItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'STAFF'] },
];

const superAdminItems = [
  { label: 'Empresas', href: '/companies', icon: Building2, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Suscriptores', href: '/subscribers', icon: UserPlus, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Solicitudes', href: '/upgrade-requests', icon: ArrowUpCircle, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Planes', href: '/subscriptions', icon: CreditCard, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Plantillas de Boletas', href: '/invoices/templates', icon: FileText, roles: ['SUPER_ADMIN'] },
];

const companyItems = [
  { label: 'Productos', href: '/products', icon: Package, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'STAFF'] },
  { label: 'Categorías', href: '/categories', icon: FolderTree, roles: ['COMPANY_ADMIN', 'MANAGER'] },
  { label: 'Ventas', href: '/sales', icon: ShoppingCart, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Clientes', href: '/customers', icon: Users, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Empleados', href: '/employees', icon: UserCog, roles: ['COMPANY_ADMIN', 'MANAGER'] },
  { label: 'Reportes', href: '/reports', icon: BarChart3, roles: ['COMPANY_ADMIN', 'MANAGER'] },
];

const adminItems = [
  { label: 'Audit Log', href: '/audit', icon: Activity, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Notificaciones', href: '/notifications', icon: Bell, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
];

type AppSidebarProps = {
  roles: string[];
};

export function AppSidebar({ roles }: AppSidebarProps) {
  const pathname = usePathname();
  
  const isSuperAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');
  const isCompanyAdmin = roles.includes('COMPANY_ADMIN');

  const visibleMainItems = mainItems.filter((item) => item.roles.some((role) => roles.includes(role)));
  const visibleSuperAdminItems = superAdminItems.filter((item) => item.roles.some((role) => roles.includes(role)));
  const visibleCompanyItems = companyItems.filter((item) => item.roles.some((role) => roles.includes(role)));
  const visibleAdminItems = adminItems.filter((item) => item.roles.some((role) => roles.includes(role)));

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-white/10 bg-[#0d1520] px-4 py-6 lg:flex lg:w-64 shrink-0">
      <div className="flex min-h-0 flex-col gap-6 overflow-hidden">
        <div className="rounded-2xl border border-white/5 bg-white/5 p-4 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Ventas SaaS</p>
          <p className="mt-2 font-display text-2xl text-white">Control</p>
          <p className="mt-1 text-xs font-medium text-orange-400">Stack</p>
        </div>

        <nav className="space-y-1 overflow-y-auto py-1">
          {visibleMainItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  active 
                    ? 'bg-orange-500/15 text-orange-400' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`size-4 ${active ? 'text-orange-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isCompanyAdmin && visibleCompanyItems.length > 0 && (
          <nav className="space-y-1 overflow-y-auto py-1">
            <p className="px-4 text-[10px] uppercase tracking-[0.2em] text-white/30">Gestión</p>
            {visibleCompanyItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    active 
                      ? 'bg-orange-500/15 text-orange-400' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`size-4 ${active ? 'text-orange-400' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {isSuperAdmin && visibleSuperAdminItems.length > 0 && (
          <nav className="space-y-1 overflow-y-auto py-1">
            <p className="px-4 text-[10px] uppercase tracking-[0.2em] text-white/30">Plataforma</p>
            {visibleSuperAdminItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    active 
                      ? 'bg-orange-500/15 text-orange-400' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`size-4 ${active ? 'text-orange-400' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {isSuperAdmin && visibleAdminItems.length > 0 && (
          <nav className="space-y-1 overflow-y-auto py-1">
            <p className="px-4 text-[10px] uppercase tracking-[0.2em] text-white/30">Sistema</p>
            {visibleAdminItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    active 
                      ? 'bg-orange-500/15 text-orange-400' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`size-4 ${active ? 'text-orange-400' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      <div className="rounded-xl border border-white/5 bg-white/5 p-4 shrink-0">
        <p className="text-xs text-white/40">¿Necesitas ayuda?</p>
        <p className="mt-1 text-sm text-white/60">Consulta la documentación</p>
      </div>
    </aside>
  );
}
