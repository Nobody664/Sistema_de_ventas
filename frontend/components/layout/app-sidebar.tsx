import Link from 'next/link';
import { BarChart3, Building2, CreditCard, LayoutDashboard, Package, ShoppingCart, Users } from 'lucide-react';

const items = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Empresas', href: '#', icon: Building2, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN'] },
  { label: 'Suscripciones', href: '#', icon: CreditCard, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'COMPANY_ADMIN'] },
  { label: 'Productos', href: '#', icon: Package, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Ventas', href: '#', icon: ShoppingCart, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Clientes', href: '#', icon: Users, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Reportes', href: '#', icon: BarChart3, roles: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'COMPANY_ADMIN', 'MANAGER'] },
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
        <p className="mt-3 text-sm leading-7 text-white/65">
          Navegación base para super admin, admin de empresa y operación POS.
        </p>
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
