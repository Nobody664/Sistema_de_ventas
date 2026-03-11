import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Activity, Filter, Search, Calendar, User, Building2, ShoppingCart, Package, Users, CreditCard, Settings } from 'lucide-react';

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  companyId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user?: { email: string; fullName: string };
  company?: { name: string };
};

export default async function AuditPage() {
  const session = await auth();
  const accessToken = session?.accessToken;
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto size-12 text-foreground/30" />
          <h2 className="mt-4 font-display text-2xl">Acceso restringido</h2>
          <p className="mt-2 text-foreground/50">No tienes permisos para ver esta página.</p>
        </div>
      </div>
    );
  }

  const auditLogs = await serverApiFetch<AuditLog[]>('/audit/global', accessToken);

  const entityIcons: Record<string, typeof Building2> = {
    Company: Building2,
    User: User,
    Sale: ShoppingCart,
    Product: Package,
    Customer: Users,
    Subscription: CreditCard,
    Plan: Settings,
  };

  const actionColors: Record<string, string> = {
    CREATE: 'bg-green-500/20 text-green-700 border-green-500/30',
    UPDATE: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
    DELETE: 'bg-red-500/20 text-red-700 border-red-500/30',
    LOGIN: 'bg-violet-500/20 text-violet-700 border-violet-500/30',
    LOGOUT: 'bg-slate-500/20 text-slate-700 border-slate-500/30',
    SEED_BOOTSTRAP: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl">Registro de actividad</h1>
          <p className="mt-1 text-foreground/50">Auditoría completa de todas las acciones en la plataforma</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            placeholder="Buscar en registros..."
            className="w-full rounded-2xl border border-foreground/10 bg-white py-3 pl-12 pr-4"
          />
        </div>
        <button className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-white px-6 py-3 text-sm font-medium transition hover:bg-foreground/5">
          <Filter className="size-4" />
          Filtros
        </button>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6">
        <div className="space-y-4">
          {auditLogs && auditLogs.length > 0 ? (
            auditLogs.map((log) => {
              const EntityIcon = entityIcons[log.entity] || Activity;
              const actionColor = actionColors[log.action] || 'bg-slate-500/20 text-slate-700 border-slate-500/30';
              
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-4 rounded-2xl border border-foreground/5 p-4 transition hover:border-foreground/10"
                >
                  <div className="rounded-xl bg-slate-100 p-3">
                    <EntityIcon className="size-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${actionColor}`}>
                        {log.action}
                      </span>
                      <span className="font-medium">{log.entity}</span>
                      {log.entityId && (
                        <span className="text-xs text-foreground/40 font-mono">{log.entityId.slice(0, 8)}...</span>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 rounded-lg bg-foreground/[0.02] p-2 text-xs font-mono text-foreground/60">
                        {JSON.stringify(log.metadata, null, 0).slice(0, 200)}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-sm text-foreground/50">
                      <span className="flex items-center gap-1">
                        <User className="size-3" />
                        {log.user?.fullName || log.user?.email || 'Sistema'}
                      </span>
                      {log.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3" />
                          {log.company.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(log.createdAt).toLocaleString('es-PE')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Activity className="size-16 text-foreground/20" />
              <h3 className="mt-4 font-display text-xl">No hay actividad</h3>
              <p className="mt-1 text-foreground/50">Los registros de actividad aparecerán aquí.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
