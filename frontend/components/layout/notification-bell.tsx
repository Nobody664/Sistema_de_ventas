'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationsStore } from '@/store/notifications-store';
import { useAuthStore } from '@/stores/auth.store';
import { getAccessToken } from '@/lib/api';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotificationBell() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const accessToken = user ? getAccessToken() : undefined;
  
  const { 
    unreadCount, 
    isConnected,
    fetchUnreadCount, 
    connectToStream, 
    disconnectFromStream,
    markAllAsRead 
  } = useNotificationsStore();

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      fetchUnreadCount(token);
      connectToStream(token);
    }

    return () => {
      disconnectFromStream();
    };
  }, [accessToken, fetchUnreadCount, connectToStream, disconnectFromStream]);

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
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
      
      {isConnected && (
        <span className="absolute bottom-0 right-0 size-2 rounded-full bg-green-500" title="Conectado" />
      )}
    </div>
  );
}
