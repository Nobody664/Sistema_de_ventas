import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import { playNotificationChime } from "@/lib/sound";
import type { Notification } from "@/types/api";

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let streamGeneration = 0;
let reconnectAttempts = 0;

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
  reset: () => void;
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
      const notifications = await apiFetch<Notification[]>("/notifications", {
        token: accessToken,
      });
      if (notifications) {
        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.isRead).length,
        });
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async (accessToken?: string) => {
    try {
      const result = await apiFetch<{ count: number }>(
        "/notifications/unread-count",
        { token: accessToken },
      );
      if (result) {
        set({ unreadCount: result.count });
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  },

  markAsRead: async (id: string, accessToken?: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, {
        method: "PATCH",
        token: accessToken,
      });

      const notifications = get().notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      );
      set({
        notifications,
        unreadCount: Math.max(0, get().unreadCount - 1),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },

  markAllAsRead: async (accessToken?: string) => {
    try {
      await apiFetch("/notifications/read-all", {
        method: "PATCH",
        token: accessToken,
      });

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
    };

    es.onmessage = (event) => {
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
              const cause = error instanceof Error ? error.cause : undefined;
              const status =
                cause && typeof cause === "object" && "statusCode" in cause
                  ? cause.statusCode
                  : undefined;
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
    playNotificationChime();
    set({
      notifications: [notification, ...notifications],
      unreadCount: unreadCount + 1,
    });
  },

  reset: () => {
    get().disconnectFromStream();
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
    });
  },
}));
