import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { FolderTree } from 'lucide-react';
import { CategoryActions, NewCategoryButton } from '@/components/categories/category-actions';
import type { Category } from '@/types/api';

export default async function CategoriesPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  const categories = await serverApiFetch<Category[]>('/products/categories', accessToken);

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-indigo-500 to-purple-600 p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Gestion de categorias</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Categorias</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Organiza tus productos en categorias para una mejor navegacion y gestion del inventario.
            </p>
          </div>
          <NewCategoryButton />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories && categories.length > 0 ? (
          categories.map((category) => (
            <Card key={category.id} className="group rounded-[30px] bg-white/80 p-6 transition hover:shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                    <FolderTree className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg">{category.name}</h3>
                    <p className="text-sm text-foreground/50">{category.slug}</p>
                  </div>
                </div>
              </div>

              {category.description && (
                <p className="mt-3 text-sm text-foreground/60">{category.description}</p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-4">
                <span className="text-sm text-foreground/50">
                  {category._count?.products ?? 0} productos
                </span>
                <CategoryActions category={category} />
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-3 flex flex-col items-center justify-center py-16">
            <FolderTree className="size-16 text-foreground/20" />
            <h3 className="mt-4 font-display text-xl">No hay categorias</h3>
            <p className="mt-1 text-foreground/50">Las categorias apareceran aqui cuando las crees.</p>
          </div>
        )}
      </div>
    </div>
  );
}
