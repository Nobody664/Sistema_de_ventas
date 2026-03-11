import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Bell, AlertTriangle, CheckCircle, Info, XCircle, Settings, Trash2, Eye, Filter, Search, CreditCard, Building2, Users, Package } from 'lucide-react';

type Notification = {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export default async function NotificationsPage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');

  const notifications: Notification[] = [
    {
      id: '1',
      type: 'SUCCESS',
      title: 'Nuevo pago recibido',
      message: 'La empresa Acme Retail realizó un pago de $59.00 USD',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      metadata: { company: 'Acme Retail', amount: 59.00 }
    },
    {
      id: '2',
      type: 'WARNING',
      title: 'Suscripción por vencer',
      message: 'La empresa Nova Market tiene su suscripción por vencer en 5 días',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      metadata: { company: 'Nova Market', daysLeft: 5 }
    },
    {
      id: '3',
      type: 'INFO',
      title: 'Nueva empresa registrada',
      message: 'TechStart Peru se unió a la plataforma',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      metadata: { company: 'TechStart Peru' }
    },
    {
      id: '4',
      type: 'ERROR',
      title: 'Pago fallido',
      message: 'El intento de pago de Metro超市 falló',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      metadata: { company: 'Metro超市', error: 'Card declined' }
    },
    {
      id: '5',
      type: 'SUCCESS',
      title: 'Empresa verificada',
      message: 'La empresa Retail Plus completó la verificación de documentos',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      metadata: { company: 'Retail Plus' }
    },
  ];

  const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string; border: string }> = {
    INFO: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    WARNING: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    ERROR: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    SUCCESS: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <Bell className="mx-auto size-12 text-foreground/30" />
          <h2 className="mt-4 font-display text-2xl">Acceso restringido</h2>
          <p className="mt-2 text-foreground/50">No tienes permisos para ver esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-4xl">Notificaciones</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-500 px-3 py-1 text-sm font-medium text-white">
                {unreadCount} nuevas
              </span>
            )}
          </div>
          <p className="mt-1 text-foreground/50">Alertas y avisos del sistema</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-white px-4 py-2 text-sm font-medium transition hover:bg-foreground/5">
            <Settings className="size-4" />
            Configurar
          </button>
          <button className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
            <Trash2 className="size-4" />
            Limpiar
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            placeholder="Buscar notificaciones..."
            className="w-full rounded-2xl border border-foreground/10 bg-white py-3 pl-12 pr-4"
          />
        </div>
        <button className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-white px-4 py-2 text-sm font-medium transition hover:bg-foreground/5">
          <Filter className="size-4" />
          Filtrar
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className={`rounded-[30px] p-6 ${unreadCount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white/80'}`}>
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-blue-100 p-2">
              <Bell className="size-5 text-blue-600" />
            </div>
            <span className="font-display text-3xl">{notifications.length}</span>
          </div>
          <p className="mt-2 text-sm text-foreground/60">Total</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-red-100 p-2">
              <XCircle className="size-5 text-red-600" />
            </div>
            <span className="font-display text-3xl">{notifications.filter(n => n.type === 'ERROR').length}</span>
          </div>
          <p className="mt-2 text-sm text-foreground/60">Errores</p>
        </Card>
        <Card className="rounded-[30xl] bg-white/80 p-6">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-amber-100 p-2">
              <AlertTriangle className="size-5 text-amber-600" />
            </div>
            <span className="font-display text-3xl">{notifications.filter(n => n.type === 'WARNING').length}</span>
          </div>
          <p className="mt-2 text-sm text-foreground/60">Advertencias</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-green-100 p-2">
              <CheckCircle className="size-5 text-green-600" />
            </div>
            <span className="font-display text-3xl">{notifications.filter(n => n.type === 'SUCCESS').length}</span>
          </div>
          <p className="mt-2 text-sm text-foreground/60">Exitosas</p>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6">
        <div className="space-y-4">
          {notifications.map((notification) => {
            const config = typeConfig[notification.type];
            const Icon = config.icon;
            
            return (
              <div
                key={notification.id}
                className={`relative flex items-start gap-4 rounded-2xl border p-5 transition hover:shadow-md ${notification.read ? 'border-foreground/5 bg-white' : config.border + ' ' + config.bg}`}
              >
                {!notification.read && (
                  <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-blue-500" />
                )}
                <div className={`rounded-xl p-3 ${config.bg}`}>
                  <Icon className={`size-6 ${config.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg">{notification.title}</h3>
                  </div>
                  <p className="mt-1 text-foreground/60">{notification.message}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-foreground/40">
                    <span>{new Date(notification.createdAt).toLocaleString('es-PE')}</span>
                    {notification.metadata && 'company' in notification.metadata && (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {notification.metadata.company as string}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg p-2 text-foreground/40 transition hover:bg-foreground/5 hover:text-foreground">
                    <Eye className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
