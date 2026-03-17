'use client';

import Link from 'next/link';
import { Edit, Trash2, AlertTriangle } from 'lucide-react';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { Category } from '@/types/api';

export function CategoryActions({ category }: { category: Category }) {
  const productCount = category._count?.products ?? 0;
  const canDelete = productCount === 0;

  return (
    <div className="flex items-center gap-2">
      <PermissionGuard permission="categories:update">
        <Link
          href={`/categories/${category.id}/edit`}
          className="rounded-lg p-2 hover:bg-foreground/5"
        >
          <Edit className="size-4 text-foreground/50" />
        </Link>
      </PermissionGuard>
      <PermissionGuard permission="categories:delete" fallback={null}>
        {canDelete ? (
          <DeleteDialog
            id={category.id}
            entity="category"
            title="Eliminar categoría"
            description={`¿Estás seguro de que deseas eliminar la categoría "${category.name}"? Esta acción no se puede deshacer.`}
          />
        ) : (
          <div className="relative group">
            <button
              disabled
              className="rounded-lg p-2 opacity-50 cursor-not-allowed"
              title={`No se puede eliminar: ${productCount} producto(s) asociado(s)`}
            >
              <Trash2 className="size-4 text-red-400" />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg max-w-[250px]">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700">No se puede eliminar</p>
                    <p className="text-xs text-red-600 mt-1">
                      Esta categoría tiene {productCount} producto(s). Elimina o reasigna los productos primero.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PermissionGuard>
    </div>
  );
}

export function NewCategoryButton() {
  return (
    <PermissionGuard permission="categories:create">
      <Link
        href="/categories/new"
        className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-indigo-600 transition hover:bg-white/90"
      >
        + Nueva categoría
      </Link>
    </PermissionGuard>
  );
}
