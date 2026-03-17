'use client';

import Link from 'next/link';
import { Edit, Trash2 } from 'lucide-react';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { Product } from '@/types/api';

export function ProductActions({ product }: { product: Product }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/products/${product.id}/edit`}
        className="rounded-lg p-2 hover:bg-foreground/5"
      >
        <Edit className="size-4 text-foreground/50" />
      </Link>
      <PermissionGuard permission="products:delete" fallback={null}>
        <DeleteDialog id={product.id} entity="product" />
      </PermissionGuard>
    </div>
  );
}

export function NewProductButton() {
  return (
    <PermissionGuard permission="products:create">
      <Link
        href="/products/new"
        className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-emerald-700 transition hover:bg-white/90"
      >
        + Nuevo producto
      </Link>
    </PermissionGuard>
  );
}
