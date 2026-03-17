import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Bell, AlertTriangle, CheckCircle, Info, XCircle, Trash2, Eye, Search, CreditCard, Building2, Clock, Check } from 'lucide-react';
import { NotificationsClient } from '@/components/notifications/notifications-client';
import type { Notification } from '@/types/api';

const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string; border: string }> = {
  SUBSCRIPTION_PENDING: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  SUBSCRIPTION_APPROVED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  SUBSCRIPTION_REJECTED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  PAYMENT_RECEIVED: { icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  PAYMENT_FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  ACCOUNT_ACTIVATED: { icon: Check, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  PLAN_UPGRADED: { icon: CheckCircle, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  GENERAL: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
};

export default async function NotificationsPage() {
  const session = await auth();
  const accessToken = session?.accessToken;
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');

  const notifications = await serverApiFetch<Notification[]>('/notifications', accessToken);
  const notificationsData = notifications || [];

  const unreadCount = notificationsData.filter(n => !n.isRead).length;

  if (!session) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <Bell className="mx-auto size-12 text-foreground/30" />
          <h2 className="mt-4 font-display text-2xl">Inicia sesión</h2>
          <p className="mt-2 text-foreground/50">Debes iniciar sesión para ver tus notificaciones.</p>
        </div>
      </div>
    );
  }

  return (
    <NotificationsClient 
      initialNotifications={notificationsData}
      unreadCount={unreadCount}
      isAdmin={isAdmin}
    />
  );
}
