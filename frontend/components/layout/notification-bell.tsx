'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationsStore } from '@/store/notifications-store';
import { useAuthStore } from '@/stores/auth.store';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotificationBell() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  
  const { 
    unreadCount, 
    isConnected,
    fetchUnreadCount, 
    connectToStream, 
    disconnectFromStream,
    markAllAsRead 
  } = useNotificationsStore();

  useEffect(() => {
    if (!user) {
      return;
    }

    fetchUnreadCount();
    connectToStream();

    const interval = window.setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    const handleFocus = () => {
      fetchUnreadCount();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnectFromStream();
    };
  }, [user, fetchUnreadCount, connectToStream, disconnectFromStream]);

  if (!user) {
    return null;
  }

  const handleClick = () => {
    router.push('/notifications');
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative rounded-full"
        onClick={handleClick}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
      
      {isConnected && (
        <span className="absolute bottom-0 right-0 size-2 rounded-full bg-green-500" title="Conectado" />
      )}
    </div>
  );
}
