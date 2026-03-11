'use client';

import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { EmployeeModal } from '@/components/employees/employee-modal';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PermissionGuard } from '@/components/auth/permission-guard';
import type { Employee } from '@/types/api';

export function EmployeeActions({ employee }: { employee: Employee }) {
  return (
    <div className="flex items-center gap-2">
      <PermissionGuard permission="employees:update">
        <EmployeeModal employee={employee}>
          <button className="rounded-lg p-2 hover:bg-foreground/5">
            <Edit className="size-4 text-foreground/50" />
          </button>
        </EmployeeModal>
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
      <EmployeeModal>
        <button className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
          <span className="text-lg">+</span>
          Nuevo empleado
        </button>
      </EmployeeModal>
    </PermissionGuard>
  );
}
