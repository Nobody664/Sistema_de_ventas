import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { Prisma } from "@prisma/client";

export enum NotificationType {
  // SUPER_ADMIN
  NEW_COMPANY_REGISTRATION = "NEW_COMPANY_REGISTRATION",
  CHECKOUT_REQUEST_PENDING = "CHECKOUT_REQUEST_PENDING",
  PLAN_UPGRADE_REQUEST = "PLAN_UPGRADE_REQUEST",
  PAYMENT_PROOF_PENDING = "PAYMENT_PROOF_PENDING",

  // SHARED
  PAYMENT_RECEIVED = "PAYMENT_RECEIVED",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  ACCOUNT_ACTIVATED = "ACCOUNT_ACTIVATED",

  // COMPANY_ADMIN
  ACCOUNT_APPROVED = "ACCOUNT_APPROVED",
  SUBSCRIPTION_PENDING = "SUBSCRIPTION_PENDING",
  SUBSCRIPTION_APPROVED = "SUBSCRIPTION_APPROVED",
  SUBSCRIPTION_REJECTED = "SUBSCRIPTION_REJECTED",
  TRIAL_EXPIRING_SOON = "TRIAL_EXPIRING_SOON",
  TRIAL_EXPIRED = "TRIAL_EXPIRED",
  PLAN_UPGRADED = "PLAN_UPGRADED",

  // MANAGER / CASHIER
  NEW_SALE = "NEW_SALE",
  LOW_STOCK = "LOW_STOCK",
  PRODUCT_EXPIRING_SOON = "PRODUCT_EXPIRING_SOON",
  NEW_CUSTOMER = "NEW_CUSTOMER",
  SALE_COMPLETED = "SALE_COMPLETED",
  SALE_RETURNED = "SALE_RETURNED",

  // GENERAL
  GENERAL = "GENERAL",
}

export enum NotificationChannel {
  EMAIL = "EMAIL",
  IN_APP = "IN_APP",
  SMS = "SMS",
}

export interface CreateNotificationInput {
  userId: string;
  companyId?: string;
  type: string;
  channel?: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export type NotificationEmitter = (notification: unknown) => void;

@Injectable()
export class NotificationsService {
  private readonly subscribers = new Map<string, Set<NotificationEmitter>>();

  constructor(private readonly prisma: PrismaService) {}

  subscribe(userId: string, emitter: NotificationEmitter): () => void {
    let emitters = this.subscribers.get(userId);
    if (!emitters) {
      emitters = new Set();
      this.subscribers.set(userId, emitters);
    }
    emitters.add(emitter);

    return () => {
      const current = this.subscribers.get(userId);
      if (!current) {
        return;
      }
      current.delete(emitter);
      if (current.size === 0) {
        this.subscribers.delete(userId);
      }
    };
  }

  emitNotification(userId: string, notification: unknown): void {
    const emitters = this.subscribers.get(userId);
    if (!emitters) {
      return;
    }
    emitters.forEach((emitter) => emitter(notification));
  }

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        companyId: input.companyId,
        type: input.type as any,
        channel: (input.channel || NotificationChannel.IN_APP) as any,
        title: input.title,
        message: input.message,
        data: (input.data || {}) as Prisma.JsonObject,
        sentAt: input.channel === NotificationChannel.EMAIL ? new Date() : null,
      },
    });

    this.emitNotification(input.userId, notification);

    return notification;
  }

  async findByUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ) {
    const where: Record<string, unknown> = { userId };

    if (options?.unreadOnly) {
      where.isRead = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 50,
    });
  }

  async findByCompany(
    companyId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ) {
    const where: Record<string, unknown> = { companyId };

    if (options?.unreadOnly) {
      where.isRead = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 50,
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async delete(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return this.prisma.notification.delete({ where: { id } });
  }
}
