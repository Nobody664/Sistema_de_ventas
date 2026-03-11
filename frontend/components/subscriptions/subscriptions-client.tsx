'use client';

import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Check, X, Mail, Phone, Calendar, CreditCard } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { CompanyWithPlanModal } from '@/components/companies/company-with-plan-modal';
import type { Company, Plan } from '@/types/api';

interface SubscriptionsClientProps {
  companies: Company[];
  plans: Plan[];
}

export function SubscriptionsClient({ companies: initialCompanies, plans }: SubscriptionsClientProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-700', label: 'Activa' },
    TRIAL: { bg: 'bg-blue-500/20', text: 'text-blue-700', label: 'Prueba' },
    SUSPENDED: { bg: 'bg-red-500/20', text: 'text-red-700', label: 'Suspendida' },
    PAST_DUE: { bg: 'bg-amber-500/20', text: 'text-amber-700', label: 'Vencida' },
  };

  const subscriptionStatusColors: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-700', label: 'Activa' },
    TRIALING: { bg: 'bg-blue-500/20', text: 'text-blue-700', label: 'Prueba' },
    PAST_DUE: { bg: 'bg-amber-500/20', text: 'text-amber-700', label: 'Vencida' },
    CANCELED: { bg: 'bg-red-500/20', text: 'text-red-700', label: 'Cancelada' },
    EXPIRED: { bg: 'bg-gray-500/20', text: 'text-gray-700', label: 'Expirada' },
  };

  const handleApprove = async (companyId: string) => {
    try {
      await apiFetch(`/companies/${companyId}/approve`, {
        method: 'POST',
        token: session?.accessToken,
      });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    } catch (error) {
      console.error('Error approving company:', error);
    }
  };

  const handleReject = async (companyId: string) => {
    try {
      await apiFetch(`/companies/${companyId}/reject`, {
        method: 'POST',
        token: session?.accessToken,
      });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    } catch (error) {
      console.error('Error rejecting company:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Gestión de empresas</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Suscripciones</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Administra las empresas registradas y sus planes de suscripción. Aprueba o rechaza solicitudes.
            </p>
          </div>
          <CompanyWithPlanModal plans={plans}>
            <button className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-medium text-violet-600 transition hover:bg-white/90">
              <Plus className="size-4" />
              Nueva empresa
            </button>
          </CompanyWithPlanModal>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Total empresas</p>
          <p className="mt-4 font-display text-3xl">{initialCompanies.length}</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Activas</p>
          <p className="mt-4 font-display text-3xl text-green-600">
            {initialCompanies.filter((c) => c.status === 'ACTIVE').length}
          </p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">En prueba</p>
          <p className="mt-4 font-display text-3xl text-blue-600">
            {initialCompanies.filter((c) => c.status === 'TRIAL').length}
          </p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Suspendidas</p>
          <p className="mt-4 font-display text-3xl text-red-600">
            {initialCompanies.filter((c) => c.status === 'SUSPENDED').length}
          </p>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6">
        <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Empresas registradas</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {initialCompanies.length > 0 ? (
            initialCompanies.map((company) => {
              const status = statusColors[company.status] || statusColors.SUSPENDED;
              const subStatus = company.subscription
                ? subscriptionStatusColors[company.subscription.status] || subscriptionStatusColors.EXPIRED
                : null;

              return (
                <Card key={company.id} className="rounded-[30px] bg-white p-6 border border-foreground/10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-lg font-semibold text-violet-600">
                        {company.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-display text-lg">{company.name}</h3>
                        <p className="text-sm text-foreground/50">@{company.slug}</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>

                  {company.subscription && (
                    <div className="mt-4 flex items-center gap-2">
                      <CreditCard className="size-4 text-foreground/50" />
                      <span className="text-sm font-medium">{company.subscription.plan?.name || 'Sin plan'}</span>
                      {subStatus && (
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${subStatus.bg} ${subStatus.text}`}>
                          {subStatus.label}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 space-y-2 text-sm text-foreground/60">
                    {company.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="size-4" />
                        <span>{company.email}</span>
                      </div>
                    )}
                    {company.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="size-4" />
                        <span>{company.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      <span>Creada {new Date(company.createdAt).toLocaleDateString('es-PE')}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-4">
                    <div className="text-center">
                      <p className="font-display text-xl">{company._count?.memberships ?? 0}</p>
                      <p className="text-xs text-foreground/50">Usuarios</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-xl">{company._count?.customers ?? 0}</p>
                      <p className="text-xs text-foreground/50">Clientes</p>
                    </div>
                    {company.status === 'TRIAL' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(company.id)}
                          className="rounded-lg p-2 hover:bg-green-50"
                          title="Aprobar"
                        >
                          <Check className="size-4 text-green-600" />
                        </button>
                        <button
                          onClick={() => handleReject(company.id)}
                          className="rounded-lg p-2 hover:bg-red-50"
                          title="Rechazar"
                        >
                          <X className="size-4 text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          ) : (
            <div className="col-span-3 flex flex-col items-center justify-center py-16">
              <Building2 className="size-16 text-foreground/20" />
              <h3 className="mt-4 font-display text-xl">No hay empresas</h3>
              <p className="mt-1 text-foreground/50">Las empresas aparecerán aquí cuando se registren.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
