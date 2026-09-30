
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { ProductForm } from '@/components/products/product-form';
import { serverApiFetch } from '@/lib/server-api';
import type { Category } from '@/types/api';

async function getCategories(accessToken: string | undefined): Promise<Category[]> {
  const categories = await serverApiFetch<Category[]>('/products/categories', accessToken);
  return categories ?? [];
}

export default async function NewProductPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const categories = await getCategories(session?.accessToken);

  return <ProductForm categories={categories} />;
}
