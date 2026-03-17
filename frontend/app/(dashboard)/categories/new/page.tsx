import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { CategoryForm } from '@/components/categories/category-form';

export default async function NewCategoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  return <CategoryForm />;
}
