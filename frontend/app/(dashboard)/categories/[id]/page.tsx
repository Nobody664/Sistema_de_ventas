import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Calendar, Edit, FolderTree, Package, Tag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import type { Category } from '@/types/api';

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CategoryDetailPage({ params }: DetailPageProps) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const category = await serverApiFetch<Category>(`/products/categories/${id}`, session.accessToken);

  if (!category) {
    notFound();
  }

  const productCount = category._count?.products;
  const details = [
    { label: 'Nombre', value: category.name },
    { label: 'Slug', value: category.slug },
    { label: 'Descripción', value: category.description || 'Sin descripción' },
    {
      label: 'Creado',
      value: new Date(category.createdAt).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    },
    {
      label: 'Actualizado',
      value: new Date(category.updatedAt).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    },
    { label: 'Productos asociados', value: productCount != null ? String(productCount) : '—' },
  ];

  return (
    <div className="space-y-6">
      <Link href="/categories" className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground">
        <ArrowLeft className="size-4" />
        Volver a categorías
      </Link>

      <Card className="rounded-[34px] bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Categoría</p>
            <h1 className="mt-3 break-words font-display text-3xl leading-tight sm:text-4xl">
              {category.name}
            </h1>
            <p className="mt-5 text-sm text-white/80">/{category.slug}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-6 py-4 text-right">
            <p className="flex items-center justify-end gap-2 text-xs uppercase tracking-[0.18em] text-white/60">
              <Package className="size-4" />
              Productos
            </p>
            <p className="mt-1 font-display text-3xl">{productCount != null ? productCount : '—'}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-500/15 p-2 text-indigo-600">
              <FolderTree className="size-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Nombre</p>
              <p className="font-display text-3xl break-words">{category.name}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-purple-500/15 p-2 text-purple-600">
              <Tag className="size-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Slug</p>
              <p className="font-display text-3xl break-all">{category.slug}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/15 p-2 text-emerald-600">
              <Calendar className="size-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Creado</p>
              <p className="font-display text-3xl">
                {new Date(category.createdAt).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-500/15 p-2 text-indigo-600">
              <FolderTree className="size-5" />
            </div>
            <h2 className="font-display text-2xl">Detalles</h2>
          </div>
          <Link
            href={`/categories/${category.id}/edit`}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background hover:opacity-90"
          >
            <Edit className="size-4" />
            Editar
          </Link>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-xs uppercase tracking-[0.18em] text-foreground/40">{detail.label}</dt>
              <dd className="mt-1 break-words text-sm text-foreground/80">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground"
        >
          <Package className="size-4" />
          Ver productos
        </Link>
      </div>
    </div>
  );
}
