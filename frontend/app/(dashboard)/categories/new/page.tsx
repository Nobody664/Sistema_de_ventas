
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { CategoryForm } from '@/components/categories/category-form';

export default async function NewCategoryPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  return <CategoryForm />;
}
