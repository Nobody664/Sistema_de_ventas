import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCommerceSession } from "@/features/store-admin/api/server";
import { StoreAdmin } from "@/components/store/store-admin";
import { StoreAdminOrders } from "@/components/store/store-admin-orders";
import { StoreAdminCustomers } from "@/components/store/store-admin-customers";
import { StoreAdminCommerce } from "@/components/store/store-admin-commerce";

const sections: Record<string, { title: string; description: string }> = {
  pedidos: {
    title: "Pedidos",
    description: "Revisa las compras, sus pagos y el progreso de cada entrega.",
  },
  pagos: {
    title: "Atención de pagos",
    description: "Revisa comprobantes, cobros y devoluciones de tus pedidos.",
  },
  entregas: {
    title: "Entregas",
    description:
      "Coordina los retiros y despachos desde el detalle del pedido.",
  },
  catalogo: {
    title: "Catálogo",
    description:
      "Elige los productos que se muestran en tu tienda. El stock y los precios se administran en Gestión de ventas.",
  },
  clientes: {
    title: "Clientes de la tienda",
    description: "Gestiona las cuentas comerciales de tu empresa.",
  },
  configuracion: {
    title: "Configuración de la tienda",
    description: "Datos comerciales, medios de pago y opciones de entrega.",
  },
  "configuracion/pagos": {
    title: "Configuración de pagos",
    description: "Configura los medios de pago disponibles en el checkout.",
  },
  "configuracion/entregas": {
    title: "Configuración de entregas",
    description: "Configura retiros y envíos para tus clientes.",
  },
  "configuracion/reglas": {
    title: "Reglas de compra",
    description: "Impuestos, reservas y habilitación del checkout.",
  },
  "atencion/pedidos": {
    title: "Atención de pedidos existentes",
    description:
      "Resuelve pagos, devoluciones y entregas pendientes de tu empresa.",
  },
};

export default async function CommerceSectionPage({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  const { context } = await getCommerceSession();
  const attention = section[0] === "atencion" && section[1] === "pedidos";
  const detail =
    (section[0] === "pedidos" && section.length === 2) ||
    (attention && section.length === 3);
  const key = detail
    ? attention
      ? "atencion/pedidos"
      : "pedidos"
    : section.join("/");
  const entry = sections[key];
  if (!entry) notFound();
  if (context.mode === "CLOSEOUT" && !attention)
    redirect("/comercio/atencion/pedidos");
  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
          Centro de tienda
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">{entry.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/60">
          {entry.description}
        </p>
      </div>
      {(key === "pedidos" ||
        key === "pagos" ||
        key === "entregas" ||
        attention) && (
        <div className="store-portal store-admin">
          <StoreAdminOrders
            allowConfiguration={false}
            initialOrderId={detail ? section.at(-1) : undefined}
          />
        </div>
      )}
      {key === "catalogo" && <StoreAdmin section="catalogo" />}
      {key === "clientes" && (
        <div className="store-portal store-admin">
          <StoreAdminCustomers />
        </div>
      )}
      {key === "configuracion" && (
        <>
          <div className="flex flex-wrap gap-3">
            {["pagos", "entregas", "reglas"].map((part) => (
              <Link
                key={part}
                href={`/comercio/configuracion/${part}`}
                className="rounded-full border border-foreground/15 px-4 py-2 text-sm capitalize hover:bg-foreground/5"
              >
                {part}
              </Link>
            ))}
          </div>
          <StoreAdmin section="configuracion" />
        </>
      )}
      {key.startsWith("configuracion/") && (
        <div className="store-portal store-admin">
          <StoreAdminCommerce
            section={section[1] as "pagos" | "entregas" | "reglas"}
          />
        </div>
      )}
      {key === "configuracion/pagos" && (
        <div className="store-portal store-admin">
          <StoreAdminOrders configurationOnly />
        </div>
      )}
    </div>
  );
}
