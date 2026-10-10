'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Bell, CreditCard, LayoutDashboard, Package, ShoppingCart, Users, UserCog, FolderTree, Warehouse } from 'lucide-react';

const mainItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER'] },
  { label: 'Notificaciones', href: '/notifications', icon: Bell, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER'] },
];

const companyItems = [
  { label: 'Inventario', href: '/inventory', icon: Warehouse, roles: ['COMPANY_ADMIN', 'MANAGER'] },
  { label: 'Productos', href: '/products', icon: Package, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Categorías', href: '/categories', icon: FolderTree, roles: ['COMPANY_ADMIN', 'MANAGER'] },
  { label: 'Ventas', href: '/sales', icon: ShoppingCart, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Clientes', href: '/customers', icon: Users, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Empleados', href: '/employees', icon: UserCog, roles: ['COMPANY_ADMIN', 'MANAGER'] },
  { label: 'Pagos', href: '/payments', icon: CreditCard, roles: ['COMPANY_ADMIN', 'MANAGER'] },
  { label: 'Reportes', href: '/reports', icon: BarChart3, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER'] },
];

const adminItems: typeof mainItems = [];

type AppSidebarProps = {
  roles: string[];
};

export function AppSidebar({ roles }: AppSidebarProps) {
  const pathname = usePathname();
  
  const isPlatformAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');
  const isCompanyAdmin = roles.includes('COMPANY_ADMIN');

  const visibleMainItems = mainItems.filter((item) => item.roles.some((role) => roles.includes(role)));
  const visibleCompanyItems = companyItems.filter((item) => item.roles.some((role) => roles.includes(role)));
  const visibleAdminItems = adminItems.filter((item) => item.roles.some((role) => roles.includes(role)));

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-sidebar-muted/50 bg-sidebar px-4 py-6 lg:flex lg:w-64 shrink-0">
      <div className="flex min-h-0 flex-col gap-6 overflow-hidden">
        <div className="rounded-2xl border border-sidebar-muted/30 bg-sidebar-muted/30 p-4 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-sidebar-foreground/40">Ventas SaaS</p>
          <p className="mt-2 font-display text-2xl text-sidebar-foreground">Control</p>
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
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground'
                }`}
              >
                <Icon className={`size-4 ${active ? 'text-orange-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {visibleCompanyItems.length > 0 && (
          <nav className="space-y-1 overflow-y-auto py-1">
            <p className="px-4 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/30">Gestión</p>
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
                      : 'text-sidebar-foreground/60 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground'
                  }`}
                >
                  <Icon className={`size-4 ${active ? 'text-orange-400' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {visibleAdminItems.length > 0 && (
          <nav className="space-y-1 overflow-y-auto py-1">
            <p className="px-4 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/30">Sistema</p>
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
                      : 'text-sidebar-foreground/60 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground'
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

      {isPlatformAdmin && (
        <div className="rounded-xl border border-sidebar-muted/30 bg-sidebar-muted/30 p-4 shrink-0">
          <Link href="/platform" className="flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300">
            <LayoutDashboard className="size-4" />
            Ir a Plataforma
          </Link>
          <p className="mt-1 text-xs text-sidebar-foreground/50">Panel global del sistema</p>
        </div>
      )}
    </aside>
  );
}
