"use client";

import {
  LogOut,
  Settings,
  User,
  CreditCard,
  Receipt,
  Users,
  UserCog,
  Package,
  ShoppingCart,
} from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "./notification-bell";
import { useAuthStore } from "@/stores/auth.store";

type AppHeaderProps = {
  fullName: string;
  companyId: string | null;
  roles: string[];
  email: string;
  nav?: ReactNode;
};

export function AppHeader({
  fullName,
  companyId,
  roles,
  email,
  nav,
}: AppHeaderProps) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const initials = (fullName ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    await logout();
    router.push("/sign-in");
  };

  const isAdminOrManager =
    roles.includes("COMPANY_ADMIN") || roles.includes("MANAGER");
  const canManageCustomers = roles.some((r) =>
    ["COMPANY_ADMIN", "MANAGER", "CASHIER"].includes(r),
  );

  return (
    <header className="sticky top-0 z-20 border-b border-foreground/10 bg-background/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 md:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {nav}
          <div className="min-w-0">
            <p className="hidden text-xs uppercase tracking-[0.22em] text-foreground/45 sm:block">
              Workspace
            </p>
            <h1 className="truncate font-display text-lg leading-tight md:text-2xl">
              Multi-tenant operations
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <ThemeToggle />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-foreground/10 bg-card p-1.5 text-sm transition hover:border-foreground/20 hover:bg-muted sm:gap-3 sm:pl-3 sm:pr-4">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[10rem] truncate text-foreground/68 sm:inline">
                  {fullName || "Usuario"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-2xl border-foreground/10 p-2"
            >
              <DropdownMenuLabel className="pb-2">
                <div className="flex flex-col">
                  <span className="font-medium">{fullName}</span>
                  <span className="text-xs font-normal text-foreground/50">
                    {email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1" />

              <Link
                href="/profile"
                className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </Link>

              {roles.includes("COMPANY_ADMIN") && (
                <Link
                  href="/subscription"
                  className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Mi Plan</span>
                </Link>
              )}

              {isAdminOrManager && (
                <Link
                  href="/payments"
                  className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  <span>Pagos</span>
                </Link>
              )}

              {canManageCustomers && (
                <Link
                  href="/customers"
                  className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>Clientes</span>
                </Link>
              )}
              {isAdminOrManager && (
                <Link
                  href="/employees"
                  className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>Empleados</span>
                </Link>
              )}

              <Link
                href="/settings"
                className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </Link>

              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                className="rounded-xl px-3 py-2 cursor-pointer text-red-600 focus:text-red-600"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
