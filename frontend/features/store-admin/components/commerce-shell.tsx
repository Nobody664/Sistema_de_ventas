"use client";

import { createContext, useContext, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  LayoutDashboard,
  Package,
  CreditCard,
  Truck,
  Users,
  Settings,
  Store,
  Menu,
} from "lucide-react";
import { AppScope } from "@/components/layout/app-scope";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { useAuthStore } from "@/stores/auth.store";
import { apiFetch } from "@/lib/api";
import {
  commerceAttentionRoute,
  storeAdminKeys,
  type StoreAdminContext,
} from "../api/contracts";
import { useCommerceReconciliation } from "../api/reconciliation";

const CommerceContext = createContext<{
  context: StoreAdminContext;
  userId: string;
} | null>(null);

export function useCommerceContext() {
  const value = useContext(CommerceContext);
  if (!value) throw new Error("Se requiere el espacio de comercio");
  return value;
}

const navigation = [
  { href: "/comercio/resumen", label: "Resumen", icon: LayoutDashboard },
  { href: "/comercio/pedidos", label: "Pedidos", icon: Package },
  { href: "/comercio/pagos", label: "Pagos", icon: CreditCard },
  { href: "/comercio/entregas", label: "Entregas", icon: Truck },
  { href: "/comercio/catalogo", label: "Catálogo", icon: Store },
  { href: "/comercio/clientes", label: "Clientes", icon: Users },
  { href: "/comercio/apariencia", label: "Apariencia", icon: Store },
  { href: "/comercio/configuracion", label: "Configuración", icon: Settings },
];

export function CommerceShell({
  context: initialContext,
  userId,
  children,
}: {
  context: StoreAdminContext;
  userId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useCommerceReconciliation(initialContext.company.id, userId);
  const ready = useSessionQueryReady();
  const user = useAuthStore((state) => state.user);
  const sameSession =
    ready &&
    user?.id === userId &&
    user?.companyId === initialContext.company.id;
  const query = useQuery({
    queryKey: storeAdminKeys(initialContext.company.id, userId).context,
    queryFn: ({ signal }) =>
      apiFetch<StoreAdminContext>("/store-admin/context", { signal }),
    initialData: initialContext,
    enabled: sameSession,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    retry: false,
  });
  const context = query.data;
  const restricted = context.mode === "CLOSEOUT";
  const attention =
    pathname === "/comercio/atencion/pedidos" ||
    pathname.startsWith("/comercio/atencion/pedidos/");
  const identityMismatch =
    ready &&
    (user?.id !== userId ||
      user?.companyId !== initialContext.company.id ||
      !user?.roles.includes("COMPANY_ADMIN"));
  useEffect(() => {
    if (identityMismatch) router.refresh();
  }, [identityMismatch, router]);
  useEffect(() => {
    if (restricted && !attention)
      router.replace(commerceAttentionRoute(pathname));
  }, [restricted, attention, pathname, router]);
  if (identityMismatch)
    return (
      <p role="status" className="p-8">
        Actualizando el acceso a la tienda…
      </p>
    );
  const links = restricted
    ? [
        {
          href: "/comercio/atencion/pedidos",
          label: "Atención de pedidos",
          icon: Package,
        },
      ]
    : navigation;
  const nav = (
    <nav aria-label="Centro de tienda" className="space-y-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground" : "text-foreground/65 hover:bg-foreground/5 hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <CommerceContext.Provider value={{ context, userId }}>
      <div data-app className="min-h-screen bg-background text-foreground">
        <AppScope />
        <a
          href="#commerce-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
        >
          Saltar al contenido
        </a>
        <div className="mx-auto flex min-h-screen max-w-[1680px]">
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-foreground/10 p-5 lg:flex">
            <Link
              href="/comercio"
              className="mb-8 flex items-center gap-3 px-3 py-3"
            >
              <Store className="h-7 w-7 text-primary" />
              <span className="font-display text-xl font-bold">
                Centro de tienda
              </span>
            </Link>
            <p className="mb-4 px-4 text-[10px] font-semibold uppercase tracking-[.22em] text-foreground/45">
              Canal comercial
            </p>
            {nav}
            <Link
              href="/dashboard"
              className="mt-auto flex items-center gap-2 rounded-xl border border-foreground/15 p-4 text-sm hover:bg-foreground/5"
            >
              <ArrowLeft className="h-4 w-4" />
              Gestión de ventas
            </Link>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-foreground/10 bg-background/95 px-5 py-3 backdrop-blur md:px-8">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[.2em] text-foreground/50">
                  Centro de tienda
                </p>
                <p className="max-w-[18rem] truncate font-display text-xl font-semibold">
                  {context.store.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <details className="relative">
                  <summary className="cursor-pointer rounded-full border border-foreground/15 px-3 py-2 text-xs">
                    Cambiar módulo
                  </summary>
                  <div className="absolute right-0 top-12 w-48 rounded-xl border border-foreground/15 bg-background p-2 shadow-lg">
                    <Link
                      href="/dashboard"
                      className="block rounded-lg p-3 text-sm hover:bg-foreground/5"
                    >
                      Gestión de ventas
                    </Link>
                    <Link
                      href="/comercio"
                      className="block rounded-lg p-3 text-sm font-semibold hover:bg-foreground/5"
                    >
                      Centro de tienda
                    </Link>
                  </div>
                </details>
                <ThemeToggle />
                <NotificationBell />
              </div>
            </header>
            <div className="flex items-center justify-between gap-3 border-b border-foreground/10 px-5 py-3 text-xs md:px-8">
              <span className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${context.store.enabled ? "bg-emerald-500" : "bg-amber-500"}`}
                />
                {context.store.enabled
                  ? "Tienda habilitada"
                  : "Tienda deshabilitada"}
              </span>
              <a
                href={`/tienda/${context.store.slug}/catalogo`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-semibold text-primary"
              >
                Ver tienda
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <details className="border-b border-foreground/10 p-4 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                <Menu className="h-4 w-4" />
                Navegación de tienda
              </summary>
              <div className="pt-4">
                {nav}
                <Link href="/dashboard" className="mt-3 block p-4 text-sm">
                  ← Gestión de ventas
                </Link>
              </div>
            </details>
            <main id="commerce-content" className="p-5 md:p-8 xl:p-10">
              {restricted && (
                <p
                  role="status"
                  className="mb-6 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm"
                >
                  Atención restringida. Puedes resolver pedidos existentes; la
                  gestión del catálogo y la configuración requieren una
                  suscripción vigente.
                </p>
              )}
              {query.isError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/40 p-5"
                >
                  <p>No se pudo verificar el acceso a la tienda.</p>
                  <button
                    className="mt-3 underline"
                    onClick={() => void query.refetch()}
                  >
                    Reintentar
                  </button>
                </div>
              ) : restricted && !attention ? (
                <p role="status">Abriendo atención de pedidos…</p>
              ) : (
                children
              )}
            </main>
          </div>
        </div>
      </div>
    </CommerceContext.Provider>
  );
}
