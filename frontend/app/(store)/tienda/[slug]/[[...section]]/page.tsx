import type { Metadata } from "next";
import { StorePortal } from "@/components/store/store-portal";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Tu tienda · Catálogo", robots: { index: false, follow: false } };

export default async function StorePage({ params }: { params: Promise<{ slug: string; section?: string[] }> }) {
  const { slug, section } = await params;
  const page = section?.[0] ?? "catalogo";
  if (!["catalogo", "carrito", "perfil", "direcciones", "pedidos", "pago", "envio", "ingresar", "registro", "recuperar", "verificar", "restablecer", "privacidad"].includes(page) || (section?.length ?? 0) > (["catalogo", "pedidos"].includes(page) ? 2 : 1)) notFound();
  return <StorePortal key={`${slug}:${page}:${section?.[1] ?? ""}`} slug={slug} section={section?.[0] ?? "catalogo"} detailId={section?.[1]} />;
}
