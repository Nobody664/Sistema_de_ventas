import Link from "next/link";
import { getCommerceSession } from "@/features/store-admin/api/server";
import { CommerceContextProvider } from "@/features/store-admin/components/commerce-shell";
import { ExperienceControl } from "@/features/store-admin/components/experience-control";
import { StoreAdmin } from "@/components/store/store-admin";
import { StoreAdminOrders } from "@/components/store/store-admin-orders";
import { AppScope } from "@/components/layout/app-scope";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function LegacyCommercePage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { context, user } = await getCommerceSession();
  const { pedido } = await searchParams;
  const orderId =
    typeof pedido === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(pedido)
      ? pedido
      : undefined;
  return (
    <CommerceContextProvider context={context} userId={user.id}>
      <div data-app className="min-h-screen bg-background text-foreground">
        <AppScope />
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 p-5">
          <div>
            <h1 className="font-display text-xl font-semibold">
              Administración de tienda · Panel anterior
            </h1>
            <p className="mt-1 text-xs text-foreground/50">
              {context.store.title}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm underline">
              Gestión de ventas
            </Link>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
          {context.mode === "MANAGE" && <ExperienceControl legacy />}
          {context.mode === "CLOSEOUT" ? (
            <>
              <h2 className="font-display text-2xl">
                Atención de pedidos existentes
              </h2>
              <p className="text-sm text-foreground/60">
                La gestión de catálogo y configuración está restringida.
              </p>
              <div className="store-portal store-admin">
                <StoreAdminOrders
                  allowConfiguration={false}
                  initialOrderId={orderId}
                />
              </div>
            </>
          ) : orderId ? (
            <div className="store-portal store-admin">
              <StoreAdminOrders initialOrderId={orderId} />
            </div>
          ) : (
            <StoreAdmin />
          )}
        </main>
      </div>
    </CommerceContextProvider>
  );
}
