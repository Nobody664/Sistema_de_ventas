import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { NotificationsService, NotificationType, NotificationChannel } from '@/modules/notifications/notifications.service';
import { EmailService } from '@/modules/email/email.service';
import { CompanyStatus } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  findByCompany(companyId: string) {
    return this.prisma.subscription.findFirst({
      where: { companyId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllSubscribers(filters?: { status?: string; planId?: string }) {
    const where: Record<string, unknown> = {};
    
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.planId) {
      where.planId = filters.planId;
    }

    return this.prisma.subscription.findMany({
      where,
      include: {
        plan: true,
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            createdAt: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveSubscriber(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { 
        company: {
          include: {
            memberships: {
              where: { role: 'COMPANY_ADMIN' },
              include: { user: true },
            },
          },
        },
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }

    const adminUser = subscription.company.memberships[0]?.user;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'ACTIVE' },
      });

      await tx.company.update({
        where: { id: subscription.companyId },
        data: { status: 'ACTIVE' },
      });

      if (adminUser) {
        await this.notificationsService.create({
          userId: adminUser.id,
          companyId: subscription.companyId,
          type: 'SUBSCRIPTION' as NotificationType,
          channel: 'IN_APP' as NotificationChannel,
          title: 'Suscripción aprobada',
          message: 'Tu suscripción ha sido aprobada.',
          sentAt: new Date(),
        });
      }

      return updated;
    });
  }

  async rejectSubscriber(subscriptionId: string, reason?: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { company: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'REJECTED' },
      });
    });
  }

  getStats() {
    return this.prisma.subscription.groupBy({
      by: ['status'],
      _count: { status: true },
    });
  }

  async processExpiredTrials() {
    const now = new Date();
    
    const expiredTrials = await this.prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        endDate: { lt: now },
      },
      include: {
        company: {
          include: {
            memberships: {
              where: { role: 'COMPANY_ADMIN' },
              include: { user: true },
            },
          },
        },
        plan: true,
      },
    });

    for (const subscription of expiredTrials) {
      const adminUser = subscription.company.memberships[0]?.user;
      
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' },
        });

        await tx.company.update({
          where: { id: subscription.companyId },
          data: { status: 'INACTIVE' as CompanyStatus },
        });
      });

      if (adminUser) {
        await this.notificationsService.create({
          userId: adminUser.id,
          companyId: subscription.companyId,
          type: 'SYSTEM' as NotificationType,
          channel: 'IN_APP' as NotificationChannel,
          title: 'Período de prueba expirado',
          message: `Tu período de prueba del plan ${subscription.plan.name} ha expirado.`,
          sentAt: new Date(),
        });
      }
    }

    return { processed: expiredTrials.length };
  }

  async checkLimit(companyId: string, resource: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, status: 'ACTIVE' },
      include: { plan: true },
    });

    if (!subscription) {
      return { allowed: true, current: 0, limit: null };
    }

    const plan = subscription.plan;

    if (resource === 'users') {
      const currentCount = await this.prisma.membership.count({
        where: { companyId },
      });

      const limit = plan.maxUsers;
      return {
        allowed: currentCount < limit,
        current: currentCount,
        limit,
        planName: plan.name,
      };
    }

    if (resource === 'products') {
      const currentCount = await this.prisma.product.count({
        where: { companyId },
      });

      const limit = plan.maxProducts;
      return {
        allowed: currentCount < limit,
        current: currentCount,
        limit,
        planName: plan.name,
      };
    }

    return { allowed: true, current: 0, limit: null };
  }
}