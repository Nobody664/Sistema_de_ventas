'use client';

import Link from 'next/link';
import { Edit } from 'lucide-react';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { Distributor } from '@/types/distributors';

export function DistributorActions({ distributor }: { distributor: Distributor }) {
  const hasDebtOrStock = (distributor.balance?.balanceQuantity ?? 0) > 0 || Number(distributor.balance?.debtAmount ?? 0) > 0;

  return (
    <div className="flex items-center gap-2">
      <PermissionGuard permission="distributor:update">
        <Link
          href={`/distributors/${distributor.id}/edit`}
          className="rounded-lg p-2 hover:bg-foreground/5"
          title="Editar"
        >
          <Edit className="size-4 text-foreground/50" />
        </Link>
      </PermissionGuard>
      <PermissionGuard permission="distributor:delete" fallback={null}>
        <DeleteDialog
          id={distributor.id}
          entity="distributor"
          description={
            hasDebtOrStock
              ? 'Este distribuidor tiene mercadería o deuda pendiente. Liquida y devuelve el stock antes de eliminarlo.'
              : `¿Eliminar al distribuidor ${distributor.name}? Esta acción no se puede deshacer.`
          }
        />
      </PermissionGuard>
    </div>
  );
}

export function NewDistributorButton() {
  return (
    <PermissionGuard permission="distributor:create">
      <Link
        href="/distributors/new"
        className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-orange-600 transition hover:bg-white/90"
      >
        + Nuevo distribuidor
      </Link>
    </PermissionGuard>
  );
}
