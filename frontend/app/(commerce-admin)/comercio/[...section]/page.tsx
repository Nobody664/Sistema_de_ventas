import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getCommerceSession } from "@/features/store-admin/api/server";
import { OrdersWorkspace } from "@/features/store-admin/components/orders-workspace";
import { OrderDetail } from "@/features/store-admin/components/order-detail";
import { CatalogWorkspace } from "@/features/store-admin/components/catalog-workspace";
import {
  CustomersWorkspace,
  CustomerDetail,
} from "@/features/store-admin/components/customers-workspace";
import { ConfigurationWorkspace } from "@/features/store-admin/components/configuration-workspace";
import { AppearanceWorkspace } from "@/features/store-admin/components/appearance-workspace";

export default async function CommerceSectionPage({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  const { context } = await getCommerceSession();
  const path = section.join("/");
  const attention =
    section[0] === "atencion" &&
    section[1] === "pedidos" &&
    section.length <= 3;
  const orderDetail =
    (section[0] === "pedidos" && section.length === 2) ||
    (attention && section.length === 3);
  const customerDetail = section[0] === "clientes" && section.length === 2;
  const identifier = section.at(-1)!;
  if (
    (orderDetail || customerDetail) &&
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(identifier)
  )
    notFound();
  const valid =
    [
      "pedidos",
      "pagos",
      "entregas",
      "catalogo",
      "clientes",
      "configuracion",
      "configuracion/pagos",
      "configuracion/entregas",
      "configuracion/reglas",
      "apariencia",
    ].includes(path) ||
    attention ||
    orderDetail ||
    customerDetail;
  if (!valid) notFound();
  if (context.mode === "CLOSEOUT" && !attention)
    redirect(
      `/comercio/atencion/pedidos${orderDetail ? `/${identifier}` : ""}`,
    );
  let content: React.ReactNode;
  if (orderDetail)
    content = (
      <OrderDetail id={identifier} restricted={context.mode === "CLOSEOUT"} />
    );
  else if (customerDetail) content = <CustomerDetail id={identifier} />;
  else if (
    attention ||
    path === "pedidos" ||
    path === "pagos" ||
    path === "entregas"
  )
    content = (
      <OrdersWorkspace
        area={
          path === "pagos"
            ? "pagos"
            : path === "entregas"
              ? "entregas"
              : "pedidos"
        }
        restricted={context.mode === "CLOSEOUT"}
      />
    );
  else if (path === "catalogo") content = <CatalogWorkspace />;
  else if (path === "clientes") content = <CustomersWorkspace />;
  else if (path === "apariencia") content = <AppearanceWorkspace />;
  else
    content = (
      <ConfigurationWorkspace
        section={
          (section[1] ?? "general") as
            | "general"
            | "pagos"
            | "entregas"
            | "reglas"
        }
      />
    );
  return (
    <Suspense fallback={<p role="status">Cargando sección…</p>}>
      {content}
    </Suspense>
  );
}
