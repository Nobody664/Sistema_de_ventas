import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
              include: { user: true },
              where: { role: 'COMPANY_ADMIN' },
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
          type: NotificationType.SUBSCRIPTION_APPROVED,
          channel: NotificationChannel.IN_APP,
          title: 'Suscripción aprobada',
          message: `Tu suscripción al plan ${subscription.plan.name} ha sido aprobada. Ahora puedes acceder al sistema.`,
        });

        await this.emailService.sendSubscriptionApproved(adminUser.email, subscription.company.name);
      }

      return updated;
    });
  }

  async rejectSubscriber(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { 
        company: {
          include: {
            memberships: {
              include: { user: true },
              where: { role: 'COMPANY_ADMIN' },
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
        data: { 
          status: 'CANCELED',
          canceledAt: new Date(),
        },
      });

      await tx.company.update({
        where: { id: subscription.companyId },
        data: { status: 'SUSPENDED' },
      });

      if (adminUser) {
        await this.notificationsService.create({
          userId: adminUser.id,
          companyId: subscription.companyId,
          type: NotificationType.SUBSCRIPTION_REJECTED,
          channel: NotificationChannel.IN_APP,
          title: 'Suscripción rechazada',
          message: `Tu solicitud de suscripción al plan ${subscription.plan.name} ha sido rechazada. Contacta al administrador para más información.`,
        });

        await this.emailService.sendSubscriptionRejected(adminUser.email, subscription.company.name);
      }

      return updated;
    });
  }

  async upgradePlan(companyId: string, newPlanCode: string, billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY') {
    const currentSubscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      include: { plan: true },
    });

    if (!currentSubscription) {
      throw new NotFoundException('No active subscription found.');
    }

    const newPlan = await this.prisma.plan.findUnique({
      where: { code: newPlanCode },
    });

    if (!newPlan) {
      throw new NotFoundException('Plan not found.');
    }

    const isFreePlan = newPlanCode === 'FREE' || parseFloat(newPlan.priceMonthly.toString()) === 0;
    const price = billingCycle === 'MONTHLY' ? newPlan.priceMonthly : newPlan.priceYearly;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (billingCycle === 'YEARLY' ? 12 : 1));

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planId: newPlan.id,
          billingCycle,
          startDate,
          endDate,
          status: isFreePlan ? 'ACTIVE' : 'ACTIVE',
        },
      });

      if (!isFreePlan) {
        await tx.payment.create({
          data: {
            subscriptionId: currentSubscription.id,
            provider: 'CARD',
            amount: price,
            currency: 'PEN',
            status: 'PENDING',
            transactionId: `upgrade-${Date.now()}`,
          },
        });
      }

      return updated;
    });
  }

  async cancelSubscription(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
          autoRenew: false,
        },
      });

      await tx.company.update({
        where: { id: companyId },
        data: { status: 'SUSPENDED' },
      });

      return updated;
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
          type: NotificationType.TRIAL_EXPIRED,
          channel: NotificationChannel.IN_APP,
          title: 'Período de prueba expirado',
          message: `Tu período de prueba del plan ${subscription.plan.name} ha expirado. Mejora tu plan para continuar usando el sistema.`,
        });

        await this.emailService.sendTrialExpired(
          adminUser.email,
          subscription.company.name,
          subscription.plan.name,
        );
      }
    }

    return { processed: expiredTrials.length };
  }

  async notifyExpiringTrials(daysBefore: number = 3) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysBefore);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const futureStart = new Date(futureDate);
    futureStart.setHours(0, 0, 0, 0);
    const futureEnd = new Date(futureDate);
    futureEnd.setHours(23, 59, 59, 999);

    const expiringTrials = await this.prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        endDate: {
          gte: futureStart,
          lte: futureEnd,
        },
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

    for (const subscription of expiringTrials) {
      const adminUser = subscription.company.memberships[0]?.user;
      const daysLeft = Math.ceil((new Date(subscription.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (adminUser) {
        await this.notificationsService.create({
          userId: adminUser.id,
          companyId: subscription.companyId,
          type: NotificationType.TRIAL_EXPIRING_SOON,
          channel: NotificationChannel.IN_APP,
          title: 'Tu período de prueba está por terminar',
          message: `Tu período de prueba del plan ${subscription.plan.name} termina en ${daysLeft} día(s). Mejora tu plan para continuar sin interrupciones.`,
        });

        await this.emailService.sendTrialExpiringSoon(
          adminUser.email,
          subscription.company.name,
          subscription.plan.name,
          daysLeft,
        );
      }
    }

    return { notified: expiringTrials.length };
  }

  async checkPlanLimits(companyId: string, resource: 'users' | 'products') {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, status: 'ACTIVE' },
      include: { plan: true },
    });

    if (!subscription) {
      return { allowed: true, current: 0, limit: null };
    }

    const plan = subscription.plan;

    if (resource === 'users') {
      const currentCount = await this.prisma.companyMembership.count({
        where: { companyId, isActive: true },
      });

      const limit = plan.maxUsers;
      return {
        allowed: limit === null || currentCount < limit,
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
        allowed: limit === null || currentCount < limit,
        current: currentCount,
        limit,
        planName: plan.name,
      };
    }

    return { allowed: true, current: 0, limit: null };
  }
}
