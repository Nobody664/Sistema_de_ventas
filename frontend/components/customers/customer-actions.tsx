'use client';

import Link from 'next/link';
import { Edit, Trash2 } from 'lucide-react';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { Customer } from '@/types/api';

export function CustomerActions({ customer }: { customer: Customer }) {
  return (
    <div className="flex items-center gap-2">
      <PermissionGuard permission="customers:update">
        <Link
          href={`/customers/${customer.id}/edit`}
          className="rounded-lg p-2 hover:bg-foreground/5"
        >
          <Edit className="size-4 text-foreground/50" />
        </Link>
      </PermissionGuard>
      <PermissionGuard permission="customers:delete" fallback={null}>
        <DeleteDialog id={customer.id} entity="customer" />
      </PermissionGuard>
    </div>
  );
}

export function NewCustomerButton() {
  return (
    <PermissionGuard permission="customers:create">
      <Link
        href="/customers/new"
        className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-cyan-600 transition hover:bg-white/90"
      >
        + Nuevo cliente
      </Link>
    </PermissionGuard>
  );
}
