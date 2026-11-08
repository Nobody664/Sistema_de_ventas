import type { Metadata } from "next";
import { StorePortal } from "@/components/store/store-portal";
import { notFound } from "next/navigation";
import { BACKEND_API_URL } from "@/lib/backend-url";
import { storePageTitle } from "@/lib/store-navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; section?: string[] }>;
}): Promise<Metadata> {
  const { slug, section } = await params;
  let name = "Tu tienda";
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/store/${encodeURIComponent(slug)}/info`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (response.ok) {
      const info: unknown = await response.json();
      if (
        info &&
        typeof info === "object" &&
        "name" in info &&
        typeof info.name === "string"
      )
        name = info.name;
    }
  } catch {
    name = "Tu tienda";
  }
  return {
    title: { absolute: storePageTitle(name, section?.[0] ?? "catalogo") },
    applicationName: name,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string; section?: string[] }>;
}) {
  const { slug, section } = await params;
  const page = section?.[0] ?? "catalogo";
  if (
    ![
      "catalogo",
      "carrito",
      "perfil",
      "direcciones",
      "pedidos",
      "pago",
      "envio",
      "ingresar",
      "registro",
      "recuperar",
      "verificar",
      "restablecer",
      "privacidad",
    ].includes(page) ||
    (section?.length ?? 0) > (["catalogo", "pedidos"].includes(page) ? 2 : 1)
  )
    notFound();
  return (
    <StorePortal
      key={`${slug}:${page}:${section?.[1] ?? ""}`}
      slug={slug}
      section={section?.[0] ?? "catalogo"}
      detailId={section?.[1]}
    />
  );
}
