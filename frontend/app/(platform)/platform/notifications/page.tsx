import { getServerSession } from "@/lib/session";
import { serverApiFetch } from "@/lib/server-api";
import { NotificationsClient } from "@/components/notifications/notifications-client";
import type { Notification } from "@/types/api";

export default async function PlatformNotificationsPage() {
  const session = await getServerSession();
  const notifications =
    (await serverApiFetch<Notification[]>(
      "/notifications",
      session?.accessToken,
    )) ?? [];
  return (
    <NotificationsClient
      initialNotifications={notifications}
      unreadCount={notifications.filter((entry) => !entry.isRead).length}
      isAdmin
    />
  );
}
