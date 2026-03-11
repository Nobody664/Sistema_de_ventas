'use client';

import { Edit, Trash2 } from 'lucide-react';
import { ProductModal } from '@/components/products/product-modal';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { Product, Category } from '@/types/api';

export function ProductActions({ product, categories }: { product: Product; categories: Category[] }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <ProductModal categories={categories} product={product}>
        <button className="rounded-lg p-2 hover:bg-foreground/5">
          <Edit className="size-4 text-foreground/50" />
        </button>
      </ProductModal>
      <PermissionGuard permission="products:delete" fallback={null}>
        <DeleteDialog id={product.id} entity="product" />
      </PermissionGuard>
    </div>
  );
}

export function NewProductButton({ categories }: { categories: Category[] }) {
  return (
    <PermissionGuard permission="products:create">
      <ProductModal categories={categories}>
        <button className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-emerald-700 transition hover:bg-white/90">
          + Nuevo producto
        </button>
      </ProductModal>
    </PermissionGuard>
  );
}
