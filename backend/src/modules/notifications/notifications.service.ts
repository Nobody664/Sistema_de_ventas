import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';

export enum NotificationType {
  SUBSCRIPTION_PENDING = 'SUBSCRIPTION_PENDING',
  SUBSCRIPTION_APPROVED = 'SUBSCRIPTION_APPROVED',
  SUBSCRIPTION_REJECTED = 'SUBSCRIPTION_REJECTED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  ACCOUNT_ACTIVATED = 'ACCOUNT_ACTIVATED',
  PLAN_UPGRADED = 'PLAN_UPGRADED',
  GENERAL = 'GENERAL',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
  SMS = 'SMS',
}

export interface CreateNotificationInput {
  userId: string;
  companyId?: string;
  type: NotificationType;
  channel?: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        companyId: input.companyId,
        type: input.type,
        channel: input.channel || NotificationChannel.IN_APP,
        title: input.title,
        message: input.message,
        data: input.data || {},
        sentAt: input.channel === NotificationChannel.EMAIL ? new Date() : null,
      },
    });
  }

  async findByUser(userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
    const where: Record<string, unknown> = { userId };
    
    if (options?.unreadOnly) {
      where.isRead = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
    });
  }

  async findByCompany(companyId: string, options?: { unreadOnly?: boolean; limit?: number }) {
    const where: Record<string, unknown> = { companyId };
    
    if (options?.unreadOnly) {
      where.isRead = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
    });
  }

  async markAsRead(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
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

  async delete(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.delete({ where: { id } });
  }
}
