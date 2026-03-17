'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Bell, AlertTriangle, CheckCircle, Info, XCircle, Trash2, Eye, Search, CreditCard, Building2, Clock, Check, ArrowRight } from 'lucide-react';
import type { Notification } from '@/types/api';

interface NotificationsClientProps {
  initialNotifications: Notification[];
  unreadCount: number;
  isAdmin: boolean;
}

const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string; border: string }> = {
  NEW_COMPANY_REGISTRATION: { icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  CHECKOUT_REQUEST_PENDING: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  PLAN_UPGRADE_REQUEST: { icon: ArrowRight, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  SUBSCRIPTION_PENDING: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  SUBSCRIPTION_APPROVED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  SUBSCRIPTION_REJECTED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  PAYMENT_RECEIVED: { icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  PAYMENT_FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  ACCOUNT_ACTIVATED: { icon: Check, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  ACCOUNT_APPROVED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  PLAN_UPGRADED: { icon: CheckCircle, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  TRIAL_EXPIRING_SOON: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  TRIAL_EXPIRED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  NEW_SALE: { icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  LOW_STOCK: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  NEW_CUSTOMER: { icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  SALE_COMPLETED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  SALE_RETURNED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  GENERAL: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
};

const notificationRoutes: Record<string, string> = {
  NEW_COMPANY_REGISTRATION: '/companies',
  CHECKOUT_REQUEST_PENDING: '/upgrade-requests',
  PLAN_UPGRADE_REQUEST: '/upgrade-requests',
  PAYMENT_PROOF_PENDING: '/upgrade-requests',
  PAYMENT_RECEIVED: '/subscription',
  PAYMENT_FAILED: '/subscription',
  ACCOUNT_APPROVED: '/dashboard',
  ACCOUNT_ACTIVATED: '/dashboard',
  SUBSCRIPTION_APPROVED: '/subscription',
  SUBSCRIPTION_REJECTED: '/subscription',
  SUBSCRIPTION_PENDING: '/subscription',
  TRIAL_EXPIRING_SOON: '/subscription',
  TRIAL_EXPIRED: '/subscription',
  PLAN_UPGRADED: '/subscription',
  NEW_SALE: '/sales',
  LOW_STOCK: '/products',
  NEW_CUSTOMER: '/customers',
  SALE_COMPLETED: '/sales',
  SALE_RETURNED: '/sales',
  GENERAL: '/notifications',
};

export function NotificationsClient({ initialNotifications, unreadCount: initialUnreadCount, isAdmin }: NotificationsClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: notifications = initialNotifications } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const data = await apiFetch<Notification[]>('/notifications', {
        token: session?.accessToken,
      });
      return data || [];
    },
    initialData: initialNotifications,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/notifications/${id}/read`, {
        method: 'PATCH',
        token: session?.accessToken,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiFetch('/notifications/read-all', {
        method: 'PATCH',
        token: session?.accessToken,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = notifications.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="flex items-center gap-2"
            >
              <Check className="size-4" />
              Marcar todo como leído
            </Button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/30" />
        <input
          type="text"
          placeholder="Buscar notificaciones..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl border border-foreground/10 bg-white py-3 pl-12 pr-4"
        />
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
            <div className="rounded-xl bg-green-100 p-2">
              <CheckCircle className="size-5 text-green-600" />
            </div>
            <span className="font-display text-3xl">
              {notifications.filter(n => n.type === 'SUBSCRIPTION_APPROVED' || n.type === 'PAYMENT_RECEIVED').length}
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground/60">Exitosas</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-amber-100 p-2">
              <Clock className="size-5 text-amber-600" />
            </div>
            <span className="font-display text-3xl">
              {notifications.filter(n => n.type === 'SUBSCRIPTION_PENDING').length}
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground/60">Pendientes</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-red-100 p-2">
              <XCircle className="size-5 text-red-600" />
            </div>
            <span className="font-display text-3xl">
              {notifications.filter(n => n.type === 'SUBSCRIPTION_REJECTED' || n.type === 'PAYMENT_FAILED').length}
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground/60">Rechazadas</p>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6">
        <div className="space-y-4">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => {
              const config = typeConfig[notification.type] || typeConfig.GENERAL;
              const Icon = config.icon;
              const route = notificationRoutes[notification.type] || '/notifications';
              
              const handleClick = () => {
                if (!notification.isRead) {
                  markAsReadMutation.mutate(notification.id);
                }
                router.push(route);
              };
              
              return (
                <div
                  key={notification.id}
                  onClick={handleClick}
                  className={`relative flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition hover:shadow-md ${
                    notification.isRead ? 'border-foreground/5 bg-white' : config.border + ' ' + config.bg
                  }`}
                >
                  {!notification.isRead && (
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
                      <span className="text-foreground/30">• Click para ver</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                        disabled={markAsReadMutation.isPending}
                        className="rounded-lg p-2 text-foreground/40 transition hover:bg-foreground/5 hover:text-foreground"
                      >
                        <Check className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Bell className="size-16 text-foreground/20" />
              <h3 className="mt-4 font-display text-xl">No hay notificaciones</h3>
              <p className="mt-1 text-foreground/50">Las notificaciones aparecerán aquí.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
