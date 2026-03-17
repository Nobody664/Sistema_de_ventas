import { auth } from '@/auth';
import { serverApiFetch } from '@/lib/server-api';
import { ProductsPageClient } from './products-client';
import type { Product, Category } from '@/types/api';

export default async function ProductsPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  const [products, categories] = await Promise.all([
    serverApiFetch<Product[]>('/products', accessToken),
    serverApiFetch<Category[]>('/products/categories', accessToken),
  ]);

  return (
    <ProductsPageClient
      initialProducts={products ?? []}
      categories={categories ?? []}
    />
  );
}
