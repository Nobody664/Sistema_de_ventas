import Link from 'next/link';
import { BarChart3, Bell, Building2, CreditCard, LayoutDashboard, Package, ShoppingCart, Users, Activity, UserCog, FolderTree, UserPlus } from 'lucide-react';

const items = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Empresas', href: '/companies', icon: Building2, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Suscriptores', href: '/subscribers', icon: UserPlus, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Suscripciones', href: '/subscriptions', icon: CreditCard, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'COMPANY_ADMIN'] },
  { label: 'Productos', href: '/products', icon: Package, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Categorías', href: '/categories', icon: FolderTree, roles: ['COMPANY_ADMIN', 'MANAGER'] },
  { label: 'Ventas', href: '/sales', icon: ShoppingCart, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Clientes', href: '/customers', icon: Users, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Empleados', href: '/employees', icon: UserCog, roles: ['COMPANY_ADMIN', 'MANAGER'] },
  { label: 'Reportes', href: '/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'COMPANY_ADMIN', 'MANAGER'] },
  { label: 'Audit Log', href: '/audit', icon: Activity, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Notificaciones', href: '/notifications', icon: Bell, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
];

type AppSidebarProps = {
  roles: string[];
};

export function AppSidebar({ roles }: AppSidebarProps) {
  const visibleItems = items.filter((item) => item.roles.some((role) => roles.includes(role)));

  return (
    <aside className="hidden border-r border-foreground/10 bg-[#12212c] px-6 py-8 text-white lg:block">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.22em] text-white/55">Ventas SaaS</p>
        <p className="mt-3 font-display text-3xl">Control stack</p>
      </div>
      <nav className="mt-8 space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/72 transition hover:bg-white/10 hover:text-white"
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
