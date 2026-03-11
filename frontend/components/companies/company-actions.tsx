'use client';

import { Edit, Trash2, Pause, Play } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { CompanyModal } from '@/components/companies/company-modal';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { apiFetch } from '@/lib/api';
import type { Company } from '@/types/api';

interface CompanyActionsProps {
  company: Company;
}

export function CompanyActions({ company }: CompanyActionsProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const handleToggleStatus = async () => {
    const newStatus = company.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiFetch(`/companies/${company.id}/status`, {
        method: 'PATCH',
        token: session?.accessToken,
        body: JSON.stringify({ status: newStatus }),
      });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    } catch (error) {
      console.error('Error updating company status:', error);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <PermissionGuard permission="companies:update">
        <CompanyModal company={company}>
          <button className="rounded-lg p-2 hover:bg-foreground/5">
            <Edit className="size-4 text-foreground/50" />
          </button>
        </CompanyModal>
      </PermissionGuard>
      <PermissionGuard permission="companies:delete" fallback={null}>
        <button
          onClick={handleToggleStatus}
          className="rounded-lg p-2 hover:bg-foreground/5"
          title={company.status === 'ACTIVE' ? 'Suspender' : 'Activar'}
        >
          {company.status === 'ACTIVE' ? (
            <Pause className="size-4 text-amber-500" />
          ) : (
            <Play className="size-4 text-green-500" />
          )}
        </button>
      </PermissionGuard>
    </div>
  );
}

export function NewCompanyButton() {
  return (
    <PermissionGuard permission="companies:create">
      <CompanyModal>
        <button className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-medium text-slate-900 transition hover:bg-white/90">
          <span className="text-lg">+</span>
          Nueva empresa
        </button>
      </CompanyModal>
    </PermissionGuard>
  );
}
