import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Barcode,
  Calendar,
  Edit,
  Layers,
  Package,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import type { Product } from "@/types/api";

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

const UNIT_SHORT: Record<string, string> = {
  UNIT: "und",
  KG: "kg",
  LT: "lt",
  MT: "mt",
};

export default async function ProductDetailPage({ params }: DetailPageProps) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const product = await serverApiFetch<Product>(
    `/products/${id}`,
    session.accessToken,
  );

  if (!product) {
    notFound();
  }

  const unit = UNIT_SHORT[product.baseUnit] ?? product.baseUnit;
  const stock = Number(product.stockQuantity);
  const minStock = Number(product.minStock);
  const lowStock = stock <= minStock;
  const presentations = product.presentations ?? [];

  const stats = [
    {
      label: "Precio de venta",
      value: `S/ ${Number(product.salePrice).toFixed(2)}`,
      icon: Tag,
      tone: "text-emerald-600 bg-emerald-500/15",
    },
    {
      label: "Precio de costo",
      value:
        product.costPrice != null
          ? `S/ ${Number(product.costPrice).toFixed(2)}`
          : "—",
      icon: Package,
      tone: "text-blue-600 bg-blue-500/15",
    },
    {
      label: "Stock actual",
      value: `${stock} ${unit}`,
      icon: lowStock ? TriangleAlert : Package,
      tone: lowStock
        ? "text-red-600 bg-red-500/15"
        : "text-emerald-600 bg-emerald-500/15",
    },
    {
      label: "Stock mínimo",
      value: `${minStock} ${unit}`,
      icon: TriangleAlert,
      tone: "text-amber-600 bg-amber-500/15",
    },
  ];

  const details = [
    { label: "Descripción", value: product.description || "Sin descripción" },
    { label: "SKU", value: product.sku || "—" },
    { label: "Código de barras", value: product.barcode || "—" },
    { label: "Unidad base", value: `${product.baseUnit} (${unit})` },
    {
      label: "Categoría",
      value: product.category?.name || "Sin categoría",
    },
    { label: "Estado", value: product.isActive ? "Activo" : "Inactivo" },
    {
      label: "Creado",
      value: new Date(product.createdAt).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    },
    {
      label: "Actualizado",
      value: new Date(product.updatedAt).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a productos
      </Link>

      <Card className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">
              {product.sku || product.category?.name || "Producto"}
            </p>
            <h1 className="mt-3 break-words font-display text-3xl leading-tight sm:text-4xl">
              {product.name}
            </h1>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/80">
              <span className="rounded-full bg-white/15 px-3 py-1">
                {product.category?.name || "Sin categoría"}
              </span>
              <span
                className={`rounded-full px-3 py-1 ${
                  product.isActive ? "bg-emerald-900/30" : "bg-red-900/30"
                }`}
              >
                {product.isActive ? "Activo" : "Inactivo"}
              </span>
              {lowStock && (
                <span className="rounded-full bg-red-900/40 px-3 py-1">
                  Stock bajo
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="size-20 rounded-2xl object-cover ring-2 ring-white/40"
              />
            )}
            <Link
              href={`/products/${product.id}/edit`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
            >
              <Edit className="size-4" />
              Editar
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="rounded-[30px] bg-white/80 p-6">
              <div className="flex items-center gap-3">
                <div className={`rounded-2xl p-2 ${stat.tone}`}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                    {stat.label}
                  </p>
                  <p className="font-display text-3xl">{stat.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[34px] bg-white/85 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/15 p-2 text-emerald-600">
              <Package className="size-5" />
            </div>
            <h2 className="font-display text-2xl">Información del producto</h2>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {details.map((detail) => (
              <div key={detail.label}>
                <dt className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                  {detail.label}
                </dt>
                <dd className="mt-1 break-words text-sm text-foreground/80">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="rounded-[34px] bg-white/85 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/15 p-2 text-blue-600">
              <Layers className="size-5" />
            </div>
            <h2 className="font-display text-2xl">Presentaciones</h2>
          </div>
          <div className="mt-5 space-y-3">
            {presentations.length > 0 ? (
              presentations.map((presentation) => (
                <div
                  key={presentation.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{presentation.name}</p>
                    <p className="text-sm text-foreground/50">
                      Factor {presentation.factor}
                      {presentation.barcode ? ` · ${presentation.barcode}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-lg">
                    {presentation.price != null
                      ? `S/ ${Number(presentation.price).toFixed(2)}`
                      : "—"}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-foreground/50">
                Sin presentaciones registradas.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-6 text-sm text-foreground/50">
        {product.barcode && (
          <span className="flex items-center gap-2">
            <Barcode className="size-4" />
            {product.barcode}
          </span>
        )}
        <span className="flex items-center gap-2">
          <Calendar className="size-4" />
          Registrado el{" "}
          {new Date(product.createdAt).toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
