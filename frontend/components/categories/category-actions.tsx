'use client';

import { Edit, Trash2 } from 'lucide-react';
import { CategoryModal } from '@/components/categories/category-modal';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { Category } from '@/types/api';

export function CategoryActions({ category }: { category: Category }) {
  return (
    <div className="flex items-center gap-2">
      <PermissionGuard permission="categories:update">
        <CategoryModal category={category}>
          <button className="rounded-lg p-2 hover:bg-foreground/5">
            <Edit className="size-4 text-foreground/50" />
          </button>
        </CategoryModal>
      </PermissionGuard>
      <PermissionGuard permission="categories:delete" fallback={null}>
        <DeleteDialog
          id={category.id}
          entity="category"
          title="Eliminar categoría"
          description={`¿Estás seguro de que deseas eliminar la categoría "${category.name}"? Los productos asociados no se eliminarán.`}
        />
      </PermissionGuard>
    </div>
  );
}

export function NewCategoryButton() {
  return (
    <PermissionGuard permission="categories:create">
      <CategoryModal>
        <button className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-indigo-600 transition hover:bg-white/90">
          + Nueva categoría
        </button>
      </CategoryModal>
    </PermissionGuard>
  );
}
