import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ProductForm } from '@/components/products/product-form';
import { apiFetch } from '@/lib/api';
import type { Category } from '@/types/api';

async function getCategories(): Promise<Category[]> {
  try {
    const session = await auth();
    const categories = await apiFetch<Category[]>('/products/categories', {
      token: session?.accessToken,
    });
    return categories || [];
  } catch {
    return [];
  }
}

export default async function NewProductPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const categories = await getCategories();

  return <ProductForm categories={categories} />;
}
