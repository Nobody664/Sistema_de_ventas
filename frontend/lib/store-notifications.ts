export interface BuyerOrderNotification {
  id: string;
  orderId: string;
  version: number;
  message: string;
  readAt: string | null;
  createdAt: string;
  order: { number: string };
}
export interface BuyerNotificationFeed {
  accountId: string;
  unreadCount: number;
  data: BuyerOrderNotification[];
}
export const BUYER_ORDER_UPDATED = "store-buyer-order-updated";
export interface BuyerOrderUpdate {
  slug: string;
  accountId: string;
  orderId: string;
  version: number;
}

export function isBuyerNotificationFeed(
  value: unknown,
): value is BuyerNotificationFeed {
  if (!value || typeof value !== "object") return false;
  const feed = value as Partial<BuyerNotificationFeed>;
  return (
    typeof feed.accountId === "string" &&
    !!feed.accountId &&
    Number.isInteger(feed.unreadCount) &&
    Number(feed.unreadCount) >= 0 &&
    Array.isArray(feed.data) &&
    feed.data.length <= 50 &&
    feed.data.every(
      (notice) =>
        notice &&
        typeof notice.id === "string" &&
        typeof notice.orderId === "string" &&
        Number.isInteger(notice.version) &&
        notice.version > 0 &&
        typeof notice.message === "string" &&
        typeof notice.createdAt === "string" &&
        (notice.readAt === null || typeof notice.readAt === "string") &&
        typeof notice.order?.number === "string",
    )
  );
}

export function latestBuyerOrderUpdates(
  notices: BuyerOrderNotification[],
): BuyerOrderNotification[] {
  const latest = new Map<string, BuyerOrderNotification>();
  for (const notice of notices)
    if ((latest.get(notice.orderId)?.version ?? 0) < notice.version)
      latest.set(notice.orderId, notice);
  return [...latest.values()];
}
