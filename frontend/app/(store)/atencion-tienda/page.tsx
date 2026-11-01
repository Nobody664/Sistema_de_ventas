import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { StoreAdminOrders } from "@/components/store/store-admin-orders";

export default async function StoreCloseoutPage() {
  const session = await getServerSession();
  if (!session?.user?.companyId || !session.user.roles.includes("COMPANY_ADMIN")) redirect("/forbidden");
  return <main className="mx-auto min-h-screen max-w-6xl bg-stone-50 px-5 py-10"><h1 className="mb-3 font-display text-3xl font-bold">Atención de pedidos existentes</h1><p className="mb-8 text-stone-600">Revisa pagos, devoluciones y entregas pendientes de tu empresa.</p><StoreAdminOrders /></main>;
}
