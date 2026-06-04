import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/database/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { EmailService } from '@/modules/email/email.service';
import { NotificationType, NotificationChannel } from '@/modules/notifications/notifications.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async processBillingCycle() {
    this.logger.log('Running billing cycle...');
    const results = {
      pendingPaymentsCreated: 0,
      markedPastDue: 0,
      suspended: 0,
      expiredTrials: 0,
    };

    results.pendingPaymentsCreated = await this.createPendingPayments();
    results.markedPastDue = await this.markPastDue();
    results.suspended = await this.suspendOverdue();
    results.expiredTrials = await this.processExpiredTrials();

    this.logger.log(`Billing cycle complete: ${JSON.stringify(results)}`);
    return results;
  }

  private async createPendingPayments(): Promise<number> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: threeDaysFromNow, gte: now },
        autoRenew: true,
      },
      include: {
        plan: true,
        company: {
          include: {
            memberships: {
              where: { role: 'COMPANY_ADMIN' },
              include: { user: true },
            },
          },
        },
      },
    });

    let count = 0;
    for (const sub of subscriptions) {
      const existingPending = await this.prisma.payment.findFirst({
        where: {
          subscriptionId: sub.id,
          status: 'PENDING',
        },
      });
      if (existingPending) continue;

      await this.prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          amount: sub.plan.priceMonthly,
          currency: 'PEN',
          status: 'PENDING',
          provider: sub.provider,
        },
      });

      const admin = sub.company.memberships[0]?.user;
      if (admin) {
        const daysLeft = Math.ceil((sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        await this.notificationsService.create({
          userId: admin.id,
          companyId: sub.companyId,
          type: 'PAYMENT' as NotificationType,
          channel: 'IN_APP' as NotificationChannel,
          title: 'Pago próximo a vencer',
          message: `Tu suscripción del plan ${sub.plan.name} vence en ${daysLeft} día(s). Realiza el pago de S/ ${sub.plan.priceMonthly} para continuar usando el sistema.`,
        });

        await this.emailService.sendEmailDirect({
          to: admin.email,
          subject: `Tu suscripción vence en ${daysLeft} día(s)`,
          template: 'payment-received' as never,
          data: {
            companyName: sub.company.name,
            message: `Tu suscripción al plan ${sub.plan.name} vence el ${sub.endDate.toLocaleDateString('es-PE')}. Realiza el pago de S/ ${sub.plan.priceMonthly} para evitar la suspensión.`,
          },
        });
      }

      count++;
    }

    return count;
  }

  private async markPastDue(): Promise<number> {
    const now = new Date();

    const expired = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: now },
      },
      include: {
        plan: true,
        company: {
          include: {
            memberships: {
              where: { role: 'COMPANY_ADMIN' },
              include: { user: true },
            },
          },
        },
      },
    });

    let count = 0;
    for (const sub of expired) {
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE' },
        });
        await tx.company.update({
          where: { id: sub.companyId },
          data: { status: 'PAST_DUE' },
        });
      });

      const admin = sub.company.memberships[0]?.user;
      if (admin) {
        await this.notificationsService.create({
          userId: admin.id,
          companyId: sub.companyId,
          type: 'PAYMENT' as NotificationType,
          channel: 'IN_APP' as NotificationChannel,
          title: 'Suscripción vencida',
          message: `Tu suscripción al plan ${sub.plan.name} ha vencido. Realiza el pago de S/ ${sub.plan.priceMonthly} para reactivar tu cuenta.`,
        });
      }

      count++;
    }

    return count;
  }

  private async suspendOverdue(): Promise<number> {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const overdue = await this.prisma.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        endDate: { lt: fiveDaysAgo },
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
      },
    });

    let count = 0;
    for (const sub of overdue) {
      await this.prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: sub.companyId },
          data: { status: 'SUSPENDED' },
        });
      });

      const admin = sub.company.memberships[0]?.user;
      if (admin) {
        await this.notificationsService.create({
          userId: admin.id,
          companyId: sub.companyId,
          type: 'SYSTEM' as NotificationType,
          channel: 'IN_APP' as NotificationChannel,
          title: 'Cuenta suspendida',
          message: 'Tu cuenta ha sido suspendida por falta de pago. Contacta a soporte para reactivarla.',
        });
      }

      count++;
    }

    return count;
  }

  private async processExpiredTrials(): Promise<number> {
    const now = new Date();

    const expiredTrials = await this.prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        endDate: { lt: now },
      },
      include: {
        plan: true,
        company: {
          include: {
            memberships: {
              where: { role: 'COMPANY_ADMIN' },
              include: { user: true },
            },
          },
        },
      },
    });

    let count = 0;
    for (const sub of expiredTrials) {
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED' },
        });
        await tx.company.update({
          where: { id: sub.companyId },
          data: { status: 'INACTIVE' },
        });
      });

      const admin = sub.company.memberships[0]?.user;
      if (admin) {
        await this.notificationsService.create({
          userId: admin.id,
          companyId: sub.companyId,
          type: 'SYSTEM' as NotificationType,
          channel: 'IN_APP' as NotificationChannel,
          title: 'Período de prueba expirado',
          message: `Tu período de prueba del plan ${sub.plan.name} ha expirado. Adquiere un plan para continuar usando el sistema.`,
        });

        await this.emailService.sendEmailDirect({
          to: admin.email,
          subject: 'Tu período de prueba ha expirado',
          template: 'welcome' as never,
          data: {
            companyName: sub.company.name,
            planName: sub.plan.name,
            message: `Tu período de prueba del plan "${sub.plan.name}" ha expirado. Adquiere un plan para continuar usando el sistema.`,
          },
        });
      }

      count++;
    }

    return count;
  }

  async getBillingStatus(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
        paymentProofs: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) return null;

    const currentPending = subscription.payments.find(p => p.status === 'PENDING');
    const lastPayment = subscription.payments.find(p => p.status === 'SUCCEEDED');

    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        billingCycle: subscription.billingCycle,
      },
      currentPending: currentPending ? {
        id: currentPending.id,
        amount: currentPending.amount.toString(),
        dueDate: subscription.endDate?.toISOString() ?? null,
        status: currentPending.status,
      } : null,
      lastPayment: lastPayment ? {
        id: lastPayment.id,
        amount: lastPayment.amount.toString(),
        paidAt: lastPayment.paidAt,
        status: lastPayment.status,
      } : null,
      recentPayments: subscription.payments.slice(0, 6).map(p => ({
        id: p.id,
        amount: p.amount.toString(),
        status: p.status,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    };
  }
}
