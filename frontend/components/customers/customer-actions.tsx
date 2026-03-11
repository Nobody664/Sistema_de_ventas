'use client';

import { Edit, Trash2 } from 'lucide-react';
import { CustomerModal } from '@/components/customers/customer-modal';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { Customer } from '@/types/api';

export function CustomerActions({ customer }: { customer: Customer }) {
  return (
    <div className="flex items-center gap-2">
      <PermissionGuard permission="customers:update">
        <CustomerModal customer={customer}>
          <button className="rounded-lg p-2 hover:bg-foreground/5">
            <Edit className="size-4 text-foreground/50" />
          </button>
        </CustomerModal>
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
      <CustomerModal>
        <button className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-cyan-600 transition hover:bg-white/90">
          + Nuevo cliente
        </button>
      </CustomerModal>
    </PermissionGuard>
  );
}
