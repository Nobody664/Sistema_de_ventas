import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { NotificationsService, NotificationType, NotificationChannel } from '@/modules/notifications/notifications.service';
import { EmailService } from '@/modules/email/email.service';

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
          status: 'ACTIVE',
        },
      });

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
}
