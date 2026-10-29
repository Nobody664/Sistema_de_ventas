"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotificationsStore } from "@/store/notifications-store";
import { useAuthStore } from "@/stores/auth.store";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { isPlatformUser } from "@/lib/role-navigation";
import type { NotificationPreferences } from "@/types/notification-preferences";

export function NotificationBell() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const ready = useSessionQueryReady();
  const global = isPlatformUser(user?.roles ?? []);
  const preferences = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () =>
      apiFetch<NotificationPreferences>("/notifications/preferences"),
    enabled: ready && !!user?.companyId && !global,
  });
  useEffect(() => {
    useNotificationsStore
      .getState()
      .setSoundEnabled(global || preferences.data?.soundEnabled === true);
  }, [global, preferences.data?.soundEnabled]);

  const {
    unreadCount,
    isConnected,
    fetchUnreadCount,
    connectToStream,
    disconnectFromStream,
    markAllAsRead,
  } = useNotificationsStore();

  const [isRinging, setIsRinging] = useState(false);
  const previousUnread = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > previousUnread.current) {
      setIsRinging(true);
      const timeout = window.setTimeout(() => setIsRinging(false), 1200);
      previousUnread.current = unreadCount;
      return () => window.clearTimeout(timeout);
    }

    previousUnread.current = unreadCount;
    return undefined;
  }, [unreadCount]);

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
      if (document.visibilityState === "visible") {
        fetchUnreadCount();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      disconnectFromStream();
    };
  }, [user, fetchUnreadCount, connectToStream, disconnectFromStream]);

  if (!user) {
    return null;
  }

  const handleClick = () => {
    router.push(
      user.roles.some((role) => ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(role))
        ? "/platform/notifications"
        : "/notifications",
    );
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative rounded-full"
        onClick={handleClick}
        aria-label={`Notificaciones: ${unreadCount} sin leer`}
      >
        <Bell className={isRinging ? "size-5 animate-bell-ring" : "size-5"} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isConnected && (
        <span
          className="absolute bottom-0 right-0 size-2 rounded-full bg-green-500"
          title="Conectado"
        />
      )}
    </div>
  );
}
