import type { Metadata } from "next";
import { StorePortal } from "@/components/store/store-portal";

export const metadata: Metadata = { title: "Tu tienda · Catálogo", robots: { index: false, follow: false } };

export default async function StorePage({ params }: { params: Promise<{ slug: string; section?: string[] }> }) {
  const { slug, section } = await params;
  return <StorePortal slug={slug} section={section?.[0] ?? "catalogo"} />;
}
