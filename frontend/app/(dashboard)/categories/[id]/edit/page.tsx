
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { CategoryForm } from '@/components/categories/category-form';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import type { Category } from '@/types/api';

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

async function getCategory(id: string, accessToken: string | undefined): Promise<Category | null> {
  try {
    return await serverApiFetch<Category>(`/products/categories/${id}`, accessToken);
  } catch {
    return null;
  }
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const category = await getCategory(id, accessToken);

  if (!category) {
    notFound();
  }

  return <CategoryForm category={category} />;
}
