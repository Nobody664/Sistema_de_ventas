import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma/prisma.service';
import { NotificationsService, NotificationType, NotificationChannel } from '@/modules/notifications/notifications.service';
import { EmailService } from '@/modules/email/email.service';

const MERCADOPAGO_TEST_TOKEN = 'TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  async findByCompany(companyId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { companyId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (!subscriptions.length) {
      return [];
    }

    return subscriptions[0].payments;
  }

  async findPendingByCompany(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, status: 'ACTIVE' },
      include: {
        payments: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        },
        plan: true,
        company: true,
      },
    });

    if (!subscription) {
      return [];
    }

    return subscription.payments;
  }

  async findOne(id: string, companyId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, subscription: { companyId } },
      include: {
        subscription: {
          include: {
            plan: true,
            company: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return payment;
  }

  async generateReceipt(id: string, companyId: string) {
    const payment = await this.findOne(id, companyId);
    
    const subscription = payment.subscription;
    const company = subscription.company;
    const plan = subscription.plan;

    const receipt = {
      id: `RCP-${payment.id.slice(-8).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      dueDate: payment.status === 'PENDING' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      company: {
        name: company.name,
        taxId: company.taxId || 'Sin RUC',
      },
      plan: {
        name: plan.name,
        priceMonthly: plan.priceMonthly.toString(),
      },
      payment: {
        id: payment.id,
        amount: payment.amount.toString(),
        currency: payment.currency,
        status: payment.status,
        provider: payment.provider,
        createdAt: payment.createdAt,
      },
      subtotal: plan.priceMonthly.toString(),
      igv: (Number(plan.priceMonthly) * 0.18).toFixed(2),
      total: (Number(plan.priceMonthly) * 1.18).toFixed(2),
    };

    return receipt;
  }

  async markAsPaid(id: string, companyId: string, paymentDate?: string) {
    const payment = await this.findOne(id, companyId);
    
    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Este pago ya fue procesado');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'SUCCEEDED',
        transactionId: paymentDate ? `manual-${Date.now()}` : `paid-${Date.now()}`,
      },
      include: {
        subscription: {
          include: { plan: true, company: true },
        },
      },
    });

    const subscription = updated.subscription;
    const company = subscription.company;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE' },
    });

    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'ACTIVE' },
    });

    return {
      ...updated,
      message: 'Pago marcado como completado',
    };
  }

  async findAllPending() {
    return this.prisma.payment.findMany({
      where: { status: 'PENDING' },
      include: {
        subscription: {
          include: {
            plan: true,
            company: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats() {
    const totalPending = await this.prisma.payment.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
      _count: true,
    });

    const totalSucceeded = await this.prisma.payment.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true },
      _count: true,
    });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyRevenue = await this.prisma.payment.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: thisMonth },
      },
      _sum: { amount: true },
    });

    return {
      pending: {
        count: totalPending._count || 0,
        amount: totalPending._sum.amount?.toString() || '0',
      },
      succeeded: {
        count: totalSucceeded._count || 0,
        amount: totalSucceeded._sum.amount?.toString() || '0',
      },
      monthlyRevenue: monthlyRevenue._sum.amount?.toString() || '0',
    };
  }

  async createCheckoutSession(input: { companyId: string; planCode: string; provider: string }) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: input.planCode },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    const planData = {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      priceMonthly: plan.priceMonthly.toString(),
    };

    if (input.provider === 'mercadopago') {
      return this.createMercadoPagoCheckout(input.companyId, planData);
    }

    if (input.provider === 'yape') {
      return {
        provider: 'yape',
        planCode: input.planCode,
        companyId: input.companyId,
        status: 'pending',
        instructions: 'Transfer to Yape number: 999888777',
        amount: planData.priceMonthly,
        currency: 'PEN',
      };
    }

    return {
      provider: input.provider,
      planCode: input.planCode,
      companyId: input.companyId,
      status: 'pending',
      note: 'Provider not implemented yet',
    };
  }

  private async createMercadoPagoCheckout(companyId: string, plan: { id: string; code: string; name: string; priceMonthly: string }) {
    const Mercadopago = require('mercadopago');
    
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') || MERCADOPAGO_TEST_TOKEN;
    
    Mercadopago.configure({
      access_token: accessToken,
    });

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    const paymentData = {
      transaction_amount: Number(plan.priceMonthly),
      description: `Suscripción ${plan.name} - Ventas SaaS`,
      payment_method_id: 'yape',
      payer: {
        email: company?.email || 'customer@example.com',
      },
      external_reference: `${companyId}_${plan.code}_${Date.now()}`,
      notification_url: `${this.configService.get<string>('API_URL')}/payments/webhooks/mercadopago`,
    };

    try {
      const payment = await Mercadopago.payment.create(paymentData);
      
      return {
        provider: 'mercadopago',
        status: 'pending',
        paymentId: payment.body.id,
        redirectUrl: payment.body.transaction_details?.external_resource_url,
        planCode: plan.code,
        companyId,
        amount: plan.priceMonthly,
        currency: 'PEN',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('MercadoPago error:', errorMessage);
      
      return {
        provider: 'mercadopago',
        status: 'error',
        error: errorMessage,
        planCode: plan.code,
        companyId,
      };
    }
  }

  handleWebhook(provider: string, payload: unknown) {
    console.log(`Webhook received from ${provider}:`, payload);

    if (provider === 'mercadopago') {
      const payment = payload as { status: string; external_reference?: string; id?: string };
      
      if (payment.status === 'approved') {
        const [companyId, planCode] = (payment.external_reference || '').split('_');
        
        if (companyId && planCode) {
          this.activateSubscription(companyId, planCode, payment.id?.toString());
        }
      }
    }

    return {
      provider,
      received: true,
      processed: true,
    };
  }

  private async activateSubscription(companyId: string, planCode: string, transactionId?: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
    });

    if (!plan) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: {
          include: { user: true },
          where: { role: 'COMPANY_ADMIN' },
        },
      },
    });

    const adminUser = company?.memberships[0]?.user;

    const subscription = await this.prisma.subscription.upsert({
      where: { companyId },
      update: {
        status: 'ACTIVE',
        planId: plan.id,
        provider: 'MERCADOPAGO',
        providerSubscriptionId: transactionId,
      },
      create: {
        companyId,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MERCADOPAGO',
        providerSubscriptionId: transactionId,
        billingCycle: 'MONTHLY',
        startDate: new Date(),
      },
    });

    if (company) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { status: 'ACTIVE' },
      });

      await this.prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          provider: 'MERCADOPAGO',
          transactionId: transactionId || `mp-${Date.now()}`,
          amount: plan.priceMonthly,
          currency: 'PEN',
          status: 'SUCCEEDED',
        },
      });

      if (adminUser) {
        await this.notificationsService.create({
          userId: adminUser.id,
          companyId,
          type: NotificationType.PAYMENT_RECEIVED,
          channel: NotificationChannel.IN_APP,
          title: 'Pago recibido',
          message: `Tu pago de S/ ${plan.priceMonthly} ha sido procesado correctamente. Tu suscripción está activa.`,
        });

        await this.emailService.sendEmailDirect({
          to: adminUser.email,
          subject: '',
          template: 'payment-received' as never,
          data: { companyName: company.name, amount: plan.priceMonthly.toString() },
        });
      }
    }
  }
}
