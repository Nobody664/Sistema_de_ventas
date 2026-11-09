import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { serverApiFetch } from "@/lib/server-api";
import { isPlatformUser } from "@/lib/role-navigation";
import type { StoreAdminContext } from "./contracts";

export const getCommerceSession = cache(async () => {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");
  if (isPlatformUser(session.user.roles)) redirect("/platform");
  if (!session.user.companyId || !session.user.roles.includes("COMPANY_ADMIN"))
    redirect("/forbidden");
  const context = await serverApiFetch<StoreAdminContext>(
    "/store-admin/context",
    session.accessToken,
  );
  if (!context) throw new Error("No se pudo cargar el contexto de la tienda");
  return { user: session.user, context };
});
