import { create } from "zustand";
import { apiFetch, ApiError } from "@/lib/api";
import { playNotificationChime } from "@/lib/sound";
import type { Notification } from "@/types/api";

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let streamGeneration = 0;
let reconnectAttempts = 0;
let sessionGeneration = 0;

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isConnected: boolean;
  soundEnabled: boolean;
  eventSource: EventSource | null;

  fetchNotifications: (accessToken?: string) => Promise<void>;
  fetchUnreadCount: (accessToken?: string) => Promise<void>;
  markAsRead: (id: string, accessToken?: string) => Promise<void>;
  markAllAsRead: (accessToken?: string) => Promise<void>;
  connectToStream: (accessToken?: string) => void;
  disconnectFromStream: () => void;
  addNotification: (notification: Notification) => void;
  reset: () => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isConnected: false,
  eventSource: null,
  soundEnabled: false,
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

  fetchNotifications: async (accessToken?: string) => {
    const generation = sessionGeneration;
    set({ isLoading: true });
    try {
      const [notifications, result] = await Promise.all([
        apiFetch<Notification[]>("/notifications", { token: accessToken }),
        apiFetch<{ count: number }>("/notifications/unread-count", {
          token: accessToken,
        }),
      ]);
      if (generation === sessionGeneration) {
        set({
          notifications: [
            ...new Map(notifications.map((n) => [n.id, n])).values(),
          ],
          unreadCount: result.count,
        });
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      if (generation === sessionGeneration) set({ isLoading: false });
    }
  },

  fetchUnreadCount: async (accessToken?: string) => {
    const generation = sessionGeneration;
    try {
      const result = await apiFetch<{ count: number }>(
        "/notifications/unread-count",
        { token: accessToken },
      );
      if (generation === sessionGeneration) {
        set({ unreadCount: result.count });
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  },

  markAsRead: async (id: string, accessToken?: string) => {
    const generation = sessionGeneration;
    try {
      await apiFetch(`/notifications/${id}/read`, {
        method: "PATCH",
        token: accessToken,
      });

      if (generation !== sessionGeneration) return;
      const wasUnread = get().notifications.some(
        (n) => n.id === id && !n.isRead,
      );
      const notifications = get().notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      );
      set({
        notifications,
        unreadCount: Math.max(0, get().unreadCount - (wasUnread ? 1 : 0)),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },

  markAllAsRead: async (accessToken?: string) => {
    const generation = sessionGeneration;
    try {
      await apiFetch("/notifications/read-all", {
        method: "PATCH",
        token: accessToken,
      });

      if (generation !== sessionGeneration) return;
      const notifications = get().notifications.map((n) => ({
        ...n,
        isRead: true,
      }));
      set({ notifications, unreadCount: 0 });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  },

  connectToStream: () => {
    const { eventSource, isConnected } = get();

    if (eventSource || isConnected || reconnectTimer) {
      return;
    }

    const es = new EventSource("/api/notifications/stream", {
      withCredentials: true,
    });
    const generation = ++streamGeneration;

    es.onopen = () => {
      if (get().eventSource !== es) return;
      reconnectAttempts = 0;
      set({ isConnected: true });
      void get().fetchNotifications();
    };

    es.onmessage = (event) => {
      if (get().eventSource !== es) return;
      try {
        const notification = JSON.parse(event.data) as Notification;
        get().addNotification(notification);
      } catch (error) {
        console.error("Error parsing notification:", error);
      }
    };

    es.onerror = () => {
      if (get().eventSource !== es) return;
      set({ isConnected: false, eventSource: null });
      es.close();
      const schedule = (): void => {
        if (generation !== streamGeneration) return;
        const delay = Math.min(
          30000,
          1000 * 2 ** Math.min(reconnectAttempts++, 5),
        );
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (generation !== streamGeneration) return;
          void apiFetch<{ count: number }>("/notifications/unread-count")
            .then((result) => {
              if (generation !== streamGeneration) return;
              set({ unreadCount: result.count });
              get().connectToStream();
            })
            .catch((error: unknown) => {
              if (generation !== streamGeneration) return;
              const status =
                error instanceof ApiError ? error.status : undefined;
              if (status !== 401 && status !== 403) schedule();
            });
        }, delay);
      };
      schedule();
    };

    set({ eventSource: es });
  },

  disconnectFromStream: () => {
    streamGeneration++;
    reconnectAttempts = 0;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
    }
    set({ eventSource: null, isConnected: false });
  },

  addNotification: (notification: Notification) => {
    const { notifications, unreadCount } = get();
    const existing = notifications.find((n) => n.id === notification.id);
    if (existing) {
      const isRead = existing.isRead || notification.isRead;
      set({
        notifications: notifications.map((n) =>
          n.id === notification.id ? { ...n, ...notification, isRead } : n,
        ),
        unreadCount: Math.max(
          0,
          unreadCount - (!existing.isRead && isRead ? 1 : 0),
        ),
      });
      return;
    }
    if (!notification.isRead && get().soundEnabled) playNotificationChime();
    set({
      notifications: [notification, ...notifications],
      unreadCount: unreadCount + (notification.isRead ? 0 : 1),
    });
  },

  reset: () => {
    sessionGeneration++;
    get().disconnectFromStream();
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      soundEnabled: false,
    });
  },
}));
