import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma/prisma.service';
import { Prisma, PrismaClient } from '@prisma/client';

const MERCADOPAGO_TEST_TOKEN = 'TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Replace with env var

@Injectable()
export class PaymentsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

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
      const payment = payload as { status: string; external_reference?: string };
      
      if (payment.status === 'approved') {
        const [companyId, planCode] = (payment.external_reference || '').split('_');
        
        if (companyId && planCode) {
          this.activateSubscription(companyId, planCode);
        }
      }
    }

    return {
      provider,
      received: true,
      processed: true,
    };
  }

  private async activateSubscription(companyId: string, planCode: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
    });

    if (!plan) return;

    await this.prisma.subscription.upsert({
      where: { companyId },
      update: {
        status: 'ACTIVE',
        planId: plan.id,
      },
      create: {
        companyId,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MERCADOPAGO',
        billingCycle: 'MONTHLY',
        startDate: new Date(),
      },
    });
  }
}
