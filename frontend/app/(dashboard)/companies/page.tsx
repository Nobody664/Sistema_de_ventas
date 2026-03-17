import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Building2, Search, Mail, Phone, Calendar, CheckCircle, AlertCircle, Pause } from 'lucide-react';
import { CompanyActions, NewCompanyButton } from '@/components/companies/company-actions';
import type { Company } from '@/types/api';

export default async function CompaniesPage() {
  const session = await auth();
  const accessToken = session?.accessToken;
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto size-12 text-foreground/30" />
          <h2 className="mt-4 font-display text-2xl">Acceso restringido</h2>
          <p className="mt-2 text-foreground/50">No tienes permisos para ver esta página.</p>
        </div>
      </div>
    );
  }

  const companies = await serverApiFetch<Company[]>('/companies', accessToken);

  const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
    ACTIVE: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle, label: 'Activa' },
    SUSPENDED: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: AlertCircle, label: 'Suspendida' },
    INACTIVE: { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: AlertCircle, label: 'Inactiva' },
    PENDING: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Pause, label: 'Pendiente' },
    TRIAL: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Pause, label: 'Prueba' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl">Empresas</h1>
          <p className="mt-1 text-foreground/50">Gestiona todas las empresas registradas en la plataforma</p>
        </div>
        <NewCompanyButton />
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            placeholder="Buscar empresas..."
            className="w-full rounded-2xl border border-foreground/10 bg-white py-3 pl-12 pr-4"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {companies && companies.length > 0 ? (
          companies.map((company) => {
            const status = statusConfig[company.status] || statusConfig.PENDING;
            const StatusIcon = status.icon;
            return (
              <Card key={company.id} className="group rounded-[30px] bg-white/80 p-6 transition hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600">
                      {company.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-display text-xl">{company.name}</h3>
                      <p className="text-sm text-foreground/50">@{company.slug}</p>
                    </div>
                  </div>
                  <CompanyActions company={company} />
                </div>

                <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 ${status.bg}`}>
                  <StatusIcon className={`size-4 ${status.color}`} />
                  <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  {company.email && (
                    <div className="flex items-center gap-2 text-foreground/60">
                      <Mail className="size-4" />
                      <span>{company.email}</span>
                    </div>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-2 text-foreground/60">
                      <Phone className="size-4" />
                      <span>{company.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-foreground/60">
                    <Calendar className="size-4" />
                    <span>Creada {new Date(company.createdAt).toLocaleDateString('es-PE')}</span>
                  </div>
                  {company.trialEndsAt && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <Calendar className="size-4" />
                      <span>Trial: {new Date(company.trialEndsAt).toLocaleDateString('es-PE')}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-foreground/10 pt-4">
                  <div className="text-center">
                    <p className="font-display text-xl">{company._count?.memberships ?? 0}</p>
                    <p className="text-xs text-foreground/50">Usuarios</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-xl">{company._count?.customers ?? 0}</p>
                    <p className="text-xs text-foreground/50">Clientes</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-xl">{company.subscription?.plan?.name ?? '-'}</p>
                    <p className="text-xs text-foreground/50">Plan</p>
                  </div>
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
    </div>
  );
}
