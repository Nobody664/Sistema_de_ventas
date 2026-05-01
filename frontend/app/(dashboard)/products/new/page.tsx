
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { ProductForm } from '@/components/products/product-form';
import { apiFetch } from '@/lib/api';
import type { Category } from '@/types/api';

async function getCategories(accessToken: string | undefined): Promise<Category[]> {
  try {
    const categories = await apiFetch<Category[]>('/products/categories', {
      token: accessToken,
    });
    return categories || [];
  } catch {
    return [];
  }
}

export default async function NewProductPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const categories = await getCategories(session?.accessToken);

  return <ProductForm categories={categories} />;
}
