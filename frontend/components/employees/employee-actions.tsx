'use client';

import Link from 'next/link';
import { MoreHorizontal, Edit, Trash2, UserPlus } from 'lucide-react';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { Employee } from '@/types/api';

export function EmployeeActions({ employee }: { employee: Employee }) {
  return (
    <div className="flex items-center gap-1">
      <PermissionGuard permission="employees:update">
        <Link
          href={`/employees/${employee.id}/edit`}
          className="rounded-lg p-2 hover:bg-purple-100 transition-colors"
        >
          <Edit className="size-4 text-purple-600" />
        </Link>
      </PermissionGuard>
      <PermissionGuard permission="employees:delete" fallback={null}>
        <DeleteDialog id={employee.id} entity="employee" />
      </PermissionGuard>
    </div>
  );
}

export function NewEmployeeButton() {
  return (
    <PermissionGuard permission="employees:create">
      <Link
        href="/employees/new"
        className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        <span className="text-lg">+</span>
        Nuevo empleado
      </Link>
    </PermissionGuard>
  );
}
