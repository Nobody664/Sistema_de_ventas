'use client';

import Link from 'next/link';
import { Pencil, TicketPercent } from 'lucide-react';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { DiscountCoupon } from '@/types/api';

export function NewDiscountButton() {
  return (
    <PermissionGuard permission="discount:manage">
      <Link
        href="/discounts/new"
        className="block w-full rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-emerald-600 transition hover:bg-white/90 sm:w-auto"
      >
        + Nuevo cupón
      </Link>
    </PermissionGuard>
  );
}

export function DiscountActions({ coupon }: { coupon: DiscountCoupon }) {
  return (
    <div className="flex items-center gap-2">
      <PermissionGuard permission="discount:manage">
        <Link
          href={`/discounts/${coupon.id}/edit`}
          title="Editar cupón"
          className="rounded-lg p-2 hover:bg-foreground/5"
        >
          <Pencil className="size-4 text-foreground/50" />
        </Link>
        {coupon.isActive !== false && (
          <DeleteDialog
            id={coupon.id}
            entity="discount"
            title="Desactivar cupón"
            description={`El cupón "${coupon.code}" dejará de poder aplicarse en las ventas. No se borra su historial de usos y puedes volver a activarlo más adelante.`}
            successMessage="Cupón desactivado correctamente"
          />
        )}
      </PermissionGuard>
    </div>
  );
}

export function DiscountEmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16">
      <TicketPercent className="size-16 text-foreground/20" />
      <h3 className="mt-4 font-display text-xl">No hay cupones de descuento</h3>
      <p className="mt-1 text-foreground/50">
        Los cupones aparecerán aquí cuando los crees.
      </p>
    </div>
  );
}
