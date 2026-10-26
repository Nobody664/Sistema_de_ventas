"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  FolderTree,
  Handshake,
  Landmark,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Package,
  ReceiptText,
  ShoppingCart,
  TicketPercent,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlanCapabilities } from "@/components/plan-capabilities/plan-capabilities-provider";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
  module?: string;
}

const mainItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "dashboard",
    roles: ["COMPANY_ADMIN", "MANAGER", "CASHIER", "VIEWER"],
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
];
const operationItems: NavItem[] = [
  {
    label: "Cupones",
    href: "/discounts",
    icon: TicketPercent,
    module: "sales",
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Distribuidores",
    href: "/distributors",
    icon: Handshake,
    module: "distributors",
    roles: ["COMPANY_ADMIN", "MANAGER"],
  },
  {
    label: "Proveedores",
    href: "/suppliers",
    icon: Truck,
    roles: ["COMPANY_ADMIN", "MANAGER"],
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
];
const utilityItems: NavItem[] = [
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

const rowClass =
  "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-orange-400/70";
const inactiveClass =
  "text-sidebar-foreground/60 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground";
const activeClass = "bg-orange-500/15 text-orange-400";

function SidebarLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(rowClass, active ? activeClass : inactiveClass)}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

function SidebarContent({
  roles,
  onNavigate,
  mobile = false,
}: {
  roles: string[];
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const { can } = usePlanCapabilities();
  const visible = (item: NavItem) =>
    item.roles.some((role) => roles.includes(role)) &&
    (!item.module || can(item.module));
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const operations = operationItems.filter(visible);
  const groupActive = operations.some((item) => isActive(item.href));
  const [expanded, setExpanded] = useState(groupActive);
  const groupId = useId();
  useEffect(() => {
    setExpanded(groupActive);
  }, [pathname, groupActive]);

  const groupLabel = (
    <>
      <Layers3 className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-left">Operaciones</span>
      <ChevronRight
        className={cn(
          "size-3.5 shrink-0 transition-transform",
          mobile && expanded && "rotate-90",
        )}
        aria-hidden="true"
      />
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-7">
      <div className="shrink-0 rounded-2xl border border-sidebar-muted/50 bg-sidebar-muted/20 px-4 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-sidebar-foreground/40">
          Huanka-Saas
        </p>
        <p className="mt-1.5 font-display text-2xl text-sidebar-foreground">
          Control
        </p>
        <p className="mt-1 text-[11px] text-sidebar-foreground/45">
          Tu espacio de trabajo
        </p>
      </div>
      <nav
        aria-label="Navegación principal"
        className="min-h-0 space-y-6 overflow-y-auto pb-3"
      >
        <div className="space-y-1">
          {mainItems.filter(visible).map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
        <div className="space-y-1">
          <p className="mb-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/30">
            Gestión
          </p>
          {companyItems.filter(visible).map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onNavigate={onNavigate}
            />
          ))}
          {operations.length > 0 &&
            (mobile ? (
              <div>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={groupId}
                  onClick={() => setExpanded((value) => !value)}
                  className={cn(
                    rowClass,
                    groupActive || expanded ? activeClass : inactiveClass,
                  )}
                >
                  {groupLabel}
                </button>
                {expanded && (
                  <div
                    id={groupId}
                    className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-muted pl-2"
                  >
                    {operations.map((item) => (
                      <SidebarLink
                        key={item.href}
                        item={item}
                        active={isActive(item.href)}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      rowClass,
                      groupActive ? activeClass : inactiveClass,
                      "data-[state=open]:bg-sidebar-muted/60 data-[state=open]:text-sidebar-foreground",
                    )}
                  >
                    {groupLabel}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="start"
                  sideOffset={12}
                  collisionPadding={12}
                  className="z-[70] w-64 rounded-2xl border-sidebar-muted bg-sidebar p-2 text-sidebar-foreground shadow-xl shadow-black/20"
                >
                  <DropdownMenuLabel className="px-3 pb-3 pt-2">
                    <span className="block text-xs font-semibold">
                      Operaciones
                    </span>
                    <span className="mt-1 block text-[11px] font-normal text-sidebar-foreground/45">
                      Compras y gestión comercial
                    </span>
                  </DropdownMenuLabel>
                  {operations.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <DropdownMenuItem
                        key={item.href}
                        asChild
                        className={cn(
                          "gap-3 rounded-xl px-3 py-2.5 text-sm focus:bg-sidebar-muted focus:text-sidebar-foreground",
                          active ? activeClass : "text-sidebar-foreground/70",
                        )}
                      >
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={onNavigate}
                        >
                          <Icon
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {item.label}
                          {active && (
                            <span
                              className="ml-auto size-1.5 rounded-full bg-orange-400"
                              aria-hidden="true"
                            />
                          )}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
        </div>
        <div className="space-y-1 border-t border-sidebar-muted/50 pt-4">
          {utilityItems.filter(visible).map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

export function AppSidebar({ roles }: { roles: string[] }) {
  return (
    <aside
      aria-label="Menú de control"
      className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-muted/50 bg-sidebar px-4 py-6 lg:flex"
    >
      <SidebarContent roles={roles} />
    </aside>
  );
}

export function AppMobileNav({ roles }: { roles: string[] }) {
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
          <SidebarContent
            roles={roles}
            mobile
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
