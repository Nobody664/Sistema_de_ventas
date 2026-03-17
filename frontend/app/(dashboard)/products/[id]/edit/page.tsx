import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/products/product-form';
import { serverApiFetch } from '@/lib/server-api';
import type { Category, Product } from '@/types/api';

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

async function getProduct(id: string): Promise<Product | null> {
  const session = await auth();
  try {
    return await serverApiFetch<Product>(`/products/${id}`, session?.accessToken);
  } catch {
    return null;
  }
}

async function getCategories(): Promise<Category[]> {
  const session = await auth();
  try {
    const categories = await serverApiFetch<Category[]>('/products/categories', session?.accessToken);
    return categories || [];
  } catch {
    return [];
  }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), getCategories()]);

  if (!product) {
    notFound();
  }

  return <ProductForm product={product} categories={categories} />;
}
