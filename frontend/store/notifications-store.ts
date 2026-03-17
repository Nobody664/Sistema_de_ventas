import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { Notification } from '@/types/api';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isConnected: boolean;
  eventSource: EventSource | null;
  
  fetchNotifications: (accessToken?: string) => Promise<void>;
  fetchUnreadCount: (accessToken?: string) => Promise<void>;
  markAsRead: (id: string, accessToken?: string) => Promise<void>;
  markAllAsRead: (accessToken?: string) => Promise<void>;
  connectToStream: (accessToken?: string) => void;
  disconnectFromStream: () => void;
  addNotification: (notification: Notification) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isConnected: false,
  eventSource: null,

  fetchNotifications: async (accessToken?: string) => {
    set({ isLoading: true });
    try {
      const notifications = await apiFetch<Notification[]>('/notifications', { token: accessToken });
      if (notifications) {
        set({ notifications, unreadCount: notifications.filter(n => !n.isRead).length });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async (accessToken?: string) => {
    try {
      const result = await apiFetch<{ count: number }>('/notifications/unread-count', { token: accessToken });
      if (result) {
        set({ unreadCount: result.count });
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  },

  markAsRead: async (id: string, accessToken?: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, {
        method: 'PATCH',
        token: accessToken,
      });
      
      const notifications = get().notifications.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      );
      set({ 
        notifications, 
        unreadCount: Math.max(0, get().unreadCount - 1) 
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  markAllAsRead: async (accessToken?: string) => {
    try {
      await apiFetch('/notifications/read-all', {
        method: 'PATCH',
        token: accessToken,
      });
      
      const notifications = get().notifications.map(n => ({ ...n, isRead: true }));
      set({ notifications, unreadCount: 0 });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  connectToStream: (accessToken?: string) => {
    const { eventSource, isConnected } = get();
    
    if (eventSource || isConnected) {
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const url = accessToken 
      ? `${apiUrl}/notifications/stream?token=${encodeURIComponent(accessToken)}`
      : `${apiUrl}/notifications/stream`;
    const es = new EventSource(url, {
      withCredentials: true,
    });

    es.onopen = () => {
      set({ isConnected: true });
    };

    es.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as Notification;
        get().addNotification(notification);
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    };

    es.onerror = () => {
      set({ isConnected: false, eventSource: null });
      es.close();
    };

    set({ eventSource: es });
  },

  disconnectFromStream: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null, isConnected: false });
    }
  },

  addNotification: (notification: Notification) => {
    const { notifications, unreadCount } = get();
    set({
      notifications: [notification, ...notifications],
      unreadCount: unreadCount + 1,
    });
  },
}));
