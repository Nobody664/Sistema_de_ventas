"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  ClipboardList,
  ReceiptText,
  CreditCard,
  Handshake,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Package,
  ShoppingCart,
  TicketPercent,
  Truck,
  Users,
  UserCog,
  FolderTree,
  Warehouse,
  ArrowUpFromLine,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePlanCapabilities } from "@/components/plan-capabilities/plan-capabilities-provider";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
  module?: string;
  hint?: string;
};

const mainItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "dashboard",
    roles: [
      "SUPER_ADMIN",
      "SUPPORT_ADMIN",
      "COMPANY_ADMIN",
      "MANAGER",
      "CASHIER",
      "VIEWER",
    ],
  },
  {
    label: "Notificaciones",
    href: "/notifications",
    icon: Bell,
    module: "notifications",
    roles: [
      "SUPER_ADMIN",
      "SUPPORT_ADMIN",
      "COMPANY_ADMIN",
      "MANAGER",
      "CASHIER",
      "VIEWER",
    ],
  },
];

const companyItems: NavItem[] = [
  {
    label: "Inventario",
    href: "/inventory",
    icon: Warehouse,
    module: "inventory",
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Productos",
    href: "/products",
    icon: Package,
    module: "products",
    roles: ["COMPANY_ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "Categorías",
    href: "/categories",
    icon: FolderTree,
    module: "categories",
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Ventas",
    href: "/sales",
    icon: ShoppingCart,
    module: "sales",
    roles: ["COMPANY_ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "Cupones",
    href: "/discounts",
    icon: TicketPercent,
    module: "sales",
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Clientes",
    href: "/customers",
    icon: Users,
    module: "customers",
    roles: ["COMPANY_ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "Distribuidores",
    href: "/distributors",
    icon: Handshake,
    module: "distributors",
    roles: ["COMPANY_ADMIN", "MANAGER"],
    hint: "A quién le vendes / consignas",
  },
  {
    label: "Salidas a distribuidores",
    href: "/stock-exits",
    icon: ArrowUpFromLine,
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Proveedores",
    href: "/suppliers",
    icon: Truck,
    roles: ["COMPANY_ADMIN", "MANAGER"],
    hint: "De quién compras",
  },
  {
    label: "Órdenes de compra",
    href: "/purchase-orders",
    icon: ClipboardList,
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Notas de crédito",
    href: "/credit-notes",
    icon: ReceiptText,
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Empleados",
    href: "/employees",
    icon: UserCog,
    module: "employees",
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Pagos",
    href: "/payments",
    icon: CreditCard,
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Finanzas",
    href: "/finance",
    icon: Landmark,
    roles: ["COMPANY_ADMIN"],
  },
  {
    label: "Reportes",
    href: "/reports",
    icon: BarChart3,
    module: "reports",
    roles: ["COMPANY_ADMIN", "MANAGER", "CASHIER", "VIEWER"],
  },
  {
    label: "Soporte",
    href: "/support",
    icon: LifeBuoy,
    roles: ["COMPANY_ADMIN", "MANAGER", "CASHIER"],
  },
];

const adminItems: NavItem[] = [];

type AppSidebarProps = {
  roles: string[];
};

type SidebarContentProps = {
  roles: string[];
  onNavigate?: () => void;
};

function SidebarContent({ roles, onNavigate }: SidebarContentProps) {
  const pathname = usePathname();
  const { can } = usePlanCapabilities();

  const isPlatformAdmin =
    roles.includes("SUPER_ADMIN") || roles.includes("SUPPORT_ADMIN");

  const visibleMainItems = mainItems.filter(
    (item) =>
      item.roles.some((role) => roles.includes(role)) &&
      (!item.module || can(item.module)),
  );
  const visibleCompanyItems = companyItems.filter(
    (item) =>
      item.roles.some((role) => roles.includes(role)) &&
      (!item.module || can(item.module)),
  );
  const visibleAdminItems = adminItems.filter((item) =>
    item.roles.some((role) => roles.includes(role)),
  );

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <div className="flex min-h-0 flex-col gap-6 overflow-hidden">
        <div className="rounded-2xl border border-sidebar-muted/30 bg-sidebar-muted/30 p-4 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-sidebar-foreground/40">
            Huanka-Saas
          </p>
          <p className="mt-2 font-display text-2xl text-sidebar-foreground">
            Control
          </p>
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
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-orange-500/15 text-orange-400"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-orange-400" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {visibleCompanyItems.length > 0 && (
          <nav className="space-y-1 overflow-y-auto py-1">
            <p className="px-4 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/30">
              Gestión
            </p>
            {visibleCompanyItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-orange-500/15 text-orange-400"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon
                    className={`size-4 ${active ? "text-orange-400" : ""}`}
                  />
                  <span className="flex flex-col">
                    <span>{item.label}</span>
                    {item.hint && (
                      <span className="text-[10px] font-normal text-sidebar-foreground/40">
                        {item.hint}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}

        {visibleAdminItems.length > 0 && (
          <nav className="space-y-1 overflow-y-auto py-1">
            <p className="px-4 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/30">
              Sistema
            </p>
            {visibleAdminItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-orange-500/15 text-orange-400"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon
                    className={`size-4 ${active ? "text-orange-400" : ""}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {isPlatformAdmin && (
        <div className="rounded-xl border border-sidebar-muted/30 bg-sidebar-muted/30 p-4 shrink-0">
          <Link
            href="/platform"
            onClick={onNavigate}
            className="flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300"
          >
            <LayoutDashboard className="size-4" />
            Ir a Plataforma
          </Link>
          <p className="mt-1 text-xs text-sidebar-foreground/50">
            Panel global del sistema
          </p>
        </div>
      )}
    </>
  );
}

export function AppSidebar({ roles }: AppSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-sidebar-muted/50 bg-sidebar px-4 py-6 lg:flex lg:w-64 shrink-0">
      <SidebarContent roles={roles} />
    </aside>
  );
}

export function AppMobileNav({ roles }: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menú de navegación"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-card text-foreground/70 transition hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 max-w-[85%] gap-0 p-0">
        <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
        <SheetDescription className="sr-only">
          Accesos del sistema
        </SheetDescription>
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-6 overflow-y-auto px-4 py-6">
          <SidebarContent roles={roles} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
