import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import type { Category, Product } from "@/types/api";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

async function getProduct(
  id: string,
  accessToken: string | undefined,
): Promise<Product | null> {
  return serverApiFetch<Product>(`/products/${id}`, accessToken);
}

async function getCategories(
  accessToken: string | undefined,
): Promise<Category[]> {
  return (
    (await serverApiFetch<Category[]>("/products/categories", accessToken)) ??
    []
  );
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  if (!session?.user) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProduct(id, accessToken),
    getCategories(accessToken),
  ]);

  if (!product) {
    notFound();
  }

  return <ProductForm product={product} categories={categories} />;
}
