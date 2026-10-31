import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { REDIS_CLIENT } from "@/cache/redis.module";
import {
  Prisma,
  NotificationType as DbNotificationType,
  NotificationChannel as DbNotificationChannel,
} from "@prisma/client";
import Redis from "ioredis";
import type { Notification as StoredNotification } from "@prisma/client";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { NotificationPreferencesDto } from "./dto/notification-preferences.dto";

export const NOTIFICATIONS_CHANNEL = "notifications:events";

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
  PRODUCT_EXPIRED = "PRODUCT_EXPIRED",
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
  dedupeKey?: string;
  globalTarget?: string;
  userId: string;
  companyId?: string;
  type: string;
  channel?: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  scope?: "COMPANY" | "PLATFORM";
  actionUrl?: string;
}

export type NotificationEmitter = (notification: unknown) => void;

interface NotificationPubSubMessage {
  userId: string;
  notification: unknown;
}

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly subscribers = new Map<string, Set<NotificationEmitter>>();
  private subscriber: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redisClient?: Redis | null,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.redisClient) {
      this.logger.log("SSE en modo local (sin REDIS_URL)");
      return;
    }

    const subscriber = this.redisClient.duplicate();
    subscriber.on("error", (error: Error) => {
      this.logger.warn(`Redis pub/sub error: ${error.message}`);
    });
    subscriber.on("message", (channel: string, payload: string) => {
      if (channel === NOTIFICATIONS_CHANNEL) {
        this.onPubSubMessage(payload);
      }
    });

    try {
      await subscriber.connect();
      await subscriber.subscribe(NOTIFICATIONS_CHANNEL);
      this.subscriber = subscriber;
      this.logger.log("SSE multi-instancia habilitado (Redis pub/sub)");
    } catch (error) {
      this.logger.warn(
        `No se pudo suscribir a Redis (${(error as Error).message}); SSE local`,
      );
      subscriber.disconnect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }
    try {
      await this.subscriber.quit();
    } catch {
      // ignore errors on shutdown
    }
    this.subscriber = null;
  }

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

  private onPubSubMessage(payload: string): void {
    try {
      const message = JSON.parse(payload) as NotificationPubSubMessage;
      if (message.userId && "notification" in message) {
        this.emitNotification(message.userId, message.notification);
      }
    } catch (error) {
      this.logger.warn(`Mensaje pub/sub invalido: ${(error as Error).message}`);
    }
  }

  private async publishNotification(
    userId: string,
    notification: unknown,
  ): Promise<void> {
    if (this.subscriber && this.redisClient?.status === "ready") {
      try {
        await this.redisClient.publish(
          NOTIFICATIONS_CHANNEL,
          JSON.stringify({ userId, notification }),
        );
        return;
      } catch (error) {
        this.logger.warn(
          `No se pudo publicar en Redis (${(error as Error).message}); emit local`,
        );
      }
    }

    this.emitNotification(userId, notification);
  }

  async create(input: CreateNotificationInput) {
    const salesEvent = [
      "SALE",
      "NEW_SALE",
      "SALE_COMPLETED",
      "SALE_RETURNED",
    ].includes(input.type);
    const stockEvent = [
      "LOW_STOCK",
      "PRODUCT_EXPIRING_SOON",
      "PRODUCT_EXPIRED",
    ].includes(input.type);
    if (
      input.companyId &&
      input.scope !== "PLATFORM" &&
      (salesEvent || stockEvent)
    ) {
      const membership = await this.prisma.membership.findUnique({
        where: {
          userId_companyId: {
            userId: input.userId,
            companyId: input.companyId,
          },
        },
        select: {
          isActive: true,
          notificationSales: true,
          notificationStock: true,
        },
      });
      if (
        !membership?.isActive ||
        (salesEvent && !membership.notificationSales) ||
        (stockEvent && !membership.notificationStock)
      )
        return null;
    }
    if (input.dedupeKey) {
      const existing = await this.prisma.notification.findUnique({
        where: { dedupeKey: input.dedupeKey },
      });
      if (existing) return existing;
    }
    const platformEvent = [
      "NEW_COMPANY_REGISTRATION",
      "CHECKOUT_REQUEST_PENDING",
      "PLAN_UPGRADE_REQUEST",
      "PAYMENT_PROOF_PENDING",
    ].includes(input.type);
    const data: Prisma.NotificationUncheckedCreateInput = {
      dedupeKey: input.dedupeKey,
      globalTarget: input.globalTarget,
      userId: input.userId,
      companyId: input.companyId ?? null,
      type:
        Object.values(DbNotificationType).find(
          (value) => value === input.type,
        ) ?? DbNotificationType.SYSTEM,
      channel:
        Object.values(DbNotificationChannel).find(
          (value) => value === input.channel,
        ) ?? DbNotificationChannel.IN_APP,
      title: input.title,
      message: input.message,
      data: (input.data || {}) as Prisma.JsonObject,
      scope: input.scope ?? (platformEvent ? "PLATFORM" : "COMPANY"),
      actionUrl: input.actionUrl,
      sentAt: input.channel === NotificationChannel.EMAIL ? new Date() : null,
    };
    let notification: StoredNotification;
    try {
      notification = await this.prisma.notification.create({ data });
    } catch (error) {
      if (
        input.dedupeKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.prisma.notification.findUnique({
          where: { dedupeKey: input.dedupeKey },
        });
        if (existing) return existing;
      }
      throw error;
    }

    await this.publishNotification(input.userId, notification);

    return notification;
  }

  async notifySuperAdmins(input: {
    dedupeKey?: string;
    type?: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    actionUrl?: string;
    companyId?: string;
  }) {
    const superAdmins = await this.prisma.user.findMany({
      where: { globalRole: "SUPER_ADMIN", isActive: true },
      select: { id: true },
    });

    if (superAdmins.length === 0) {
      return { count: 0 };
    }

    let count = 0;
    for (const admin of superAdmins) {
      await this.create({
        dedupeKey: input.dedupeKey
          ? `${input.dedupeKey}:${admin.id}`
          : undefined,
        userId: admin.id,
        companyId: input.companyId,
        type:
          Object.values(DbNotificationType).find(
            (value) => value === input.type,
          ) ?? DbNotificationType.SYSTEM,
        channel: NotificationChannel.IN_APP,
        title: input.title,
        message: input.message,
        data: input.data,
        scope: "PLATFORM",
        globalTarget: "SUPER_ADMINS",
        actionUrl: input.actionUrl,
      });
      count++;
    }

    return { count };
  }

  async findByUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ) {
    const where: Prisma.NotificationWhereInput = { userId };

    if (options?.unreadOnly) {
      where.AND = [{ isRead: false }];
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 50,
    });
  }

  async getPreferences(user: AuthUser) {
    if (
      !user.companyId ||
      user.roles.some((role) => ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(role))
    ) {
      throw new ForbiddenException(
        "Las preferencias de negocio requieren una membresía de empresa",
      );
    }
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: { userId: user.sub, companyId: user.companyId },
      },
      select: {
        isActive: true,
        notificationSales: true,
        notificationStock: true,
        notificationSound: true,
      },
    });
    if (!membership?.isActive)
      throw new ForbiddenException("La membresía no está activa");
    return {
      salesEnabled: membership.notificationSales,
      stockEnabled: membership.notificationStock,
      soundEnabled: membership.notificationSound,
    };
  }

  async updatePreferences(user: AuthUser, input: NotificationPreferencesDto) {
    await this.getPreferences(user);
    for (const value of [
      input.salesEnabled,
      input.stockEnabled,
      input.soundEnabled,
    ]) {
      if (value !== undefined && typeof value !== "boolean")
        throw new BadRequestException("Preferencia inválida");
    }
    const changed = await this.prisma.membership.updateMany({
      where: { userId: user.sub, companyId: user.companyId!, isActive: true },
      data: {
        notificationSales: input.salesEnabled,
        notificationStock: input.stockEnabled,
        notificationSound: input.soundEnabled,
      },
    });
    if (changed.count !== 1)
      throw new ForbiddenException("La membresía ya no está activa");
    return this.getPreferences(user);
  }

  async findByCompany(
    companyId: string,
    options: { unreadOnly?: boolean; limit?: number } | undefined,
    actor: AuthUser,
  ) {
    if (
      !actor ||
      actor.companyId !== companyId ||
      !actor.roles.some((role) =>
        ["SUPER_ADMIN", "COMPANY_ADMIN"].includes(role),
      )
    )
      throw new ForbiddenException(
        "No puedes auditar notificaciones de esta empresa",
      );
    const where: Prisma.NotificationWhereInput = {
      companyId,
      scope: "COMPANY",
    };

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
