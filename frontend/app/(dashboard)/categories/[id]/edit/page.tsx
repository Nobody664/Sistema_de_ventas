import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { CategoryForm } from '@/components/categories/category-form';
import { serverApiFetch } from '@/lib/server-api';
import type { Category } from '@/types/api';

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

async function getCategory(id: string): Promise<Category | null> {
  const session = await auth();
  try {
    return await serverApiFetch<Category>(`/products/categories/${id}`, session?.accessToken);
  } catch {
    return null;
  }
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const category = await getCategory(id);

  if (!category) {
    notFound();
  }

  return <CategoryForm category={category} />;
}
