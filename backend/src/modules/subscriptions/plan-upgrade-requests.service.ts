import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProvider, PlanUpgradeStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { EmailService } from '@/modules/email/email.service';
import { NotificationsService, NotificationType, NotificationChannel } from '@/modules/notifications/notifications.service';
import { CreatePlanUpgradeRequestDto, SubmitUpgradeProofDto, ReviewPlanUpgradeDto } from './dto/plan-upgrade.dto';

const OFFLINE_PROVIDERS: PaymentProvider[] = [
  PaymentProvider.YAPE,
  PaymentProvider.PLIN,
  PaymentProvider.TRANSFER,
];

@Injectable()
export class PlanUpgradeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createRequest(companyId: string, input: CreatePlanUpgradeRequestDto) {
    if (!OFFLINE_PROVIDERS.includes(input.paymentMethod)) {
      throw new BadRequestException('Método de pago no soportado para upgrade offline');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { subscriptions: { include: { plan: true }, take: 1 } },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const currentSubscription = company.subscriptions?.[0];
    if (!currentSubscription) {
      throw new BadRequestException('La empresa no tiene una suscripción activa');
    }

    const newPlan = await this.prisma.plan.findUnique({
      where: { code: input.newPlanCode },
    });

    if (!newPlan) {
      throw new NotFoundException('Plan no encontrado');
    }

    if (newPlan.id === currentSubscription.planId) {
      throw new ConflictException('Ya tienes ese plan activo');
    }

    const settings = await this.prisma.paymentSetting.findFirst({
      where: { companyId, provider: input.paymentMethod, isEnabled: true },
    });

    if (!settings) {
      throw new ConflictException('Método de pago no disponible');
    }

    const billingCycle = input.billingCycle || 'MONTHLY';
    const price = billingCycle === 'MONTHLY' ? newPlan.priceMonthly : newPlan.priceYearly;

    const existingPendingRequest = await this.prisma.planUpgradeRequest.findFirst({
      where: {
        companyId,
        status: PlanUpgradeStatus.PENDING,
      },
      include: { plan: true },
    });

    if (existingPendingRequest) {
      return {
        requestId: existingPendingRequest.id,
        status: existingPendingRequest.status,
        currentPlan: {
          code: currentSubscription.plan.code,
          name: currentSubscription.plan.name,
        },
        newPlan: {
          code: existingPendingRequest.plan.code,
          name: existingPendingRequest.plan.name,
          priceMonthly: existingPendingRequest.plan.priceMonthly.toString(),
          priceYearly: existingPendingRequest.plan.priceYearly.toString(),
        },
        paymentMethod: existingPendingRequest.provider,
        paymentSettings: {
          provider: settings.provider,
          qrImageBase64: settings.qrImageBase64,
          accountNumber: settings.accountNumber,
          accountName: settings.accountName,
          instructions: settings.instructions,
        },
      };
    }

    const request = await this.prisma.planUpgradeRequest.create({
      data: {
        companyId,
        currentPlanId: currentSubscription.planId,
        planId: newPlan.id,
        provider: input.paymentMethod,
        amount: price.toString(),
        currency: 'PEN',
        status: PlanUpgradeStatus.PENDING,
      },
      include: { plan: true },
    });

    return {
      requestId: request.id,
      status: request.status,
      currentPlan: {
        code: currentSubscription.plan.code,
        name: currentSubscription.plan.name,
      },
      newPlan: {
        code: request.plan.code,
        name: request.plan.name,
        priceMonthly: request.plan.priceMonthly.toString(),
        priceYearly: request.plan.priceYearly.toString(),
      },
      paymentMethod: request.provider,
      paymentSettings: {
        provider: settings.provider,
        qrImageBase64: settings.qrImageBase64,
        accountNumber: settings.accountNumber,
        accountName: settings.accountName,
        instructions: settings.instructions,
      },
    };
  }

  async submitProof(requestId: string, input: SubmitUpgradeProofDto) {
    if (!input.imageBase64.startsWith('data:image/')) {
      throw new BadRequestException('Formato de comprobante inválido');
    }

    const request = await this.prisma.planUpgradeRequest.findUnique({
      where: { id: requestId },
      include: { plan: true, company: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.status !== PlanUpgradeStatus.PENDING) {
      throw new ConflictException('La solicitud ya fue enviada o revisada');
    }

    const updated = await this.prisma.planUpgradeRequest.update({
      where: { id: requestId },
      data: {
        proofImageBase64: input.imageBase64,
        paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
        submittedAt: new Date(),
      },
    });

    const adminUsers = await this.prisma.user.findMany({
      where: {
        globalRole: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    for (const admin of adminUsers) {
      await this.notificationsService.create({
        userId: admin.id,
        companyId: request.companyId,
        type: NotificationType.PLAN_UPGRADED,
        channel: NotificationChannel.IN_APP,
        title: 'Nueva solicitud de upgrade de plan',
        message: `${request.company.name} solicitó cambio al plan ${request.plan.name}. Requiere revisión.`,
      });
    }

    return {
      requestId: updated.id,
      status: PlanUpgradeStatus.PENDING,
    };
  }

  async getPending() {
    return this.prisma.planUpgradeRequest.findMany({
      where: { status: PlanUpgradeStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        plan: true,
      },
    });
  }

  async getByCompany(companyId: string) {
    return this.prisma.planUpgradeRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
  }

  async getPendingRequest(companyId: string) {
    const request = await this.prisma.planUpgradeRequest.findFirst({
      where: { 
        companyId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    return request;
  }

  async review(requestId: string, reviewerId: string, input: ReviewPlanUpgradeDto) {
    const request = await this.prisma.planUpgradeRequest.findUnique({
      where: { id: requestId },
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

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.status !== PlanUpgradeStatus.PENDING) {
      throw new ConflictException('La solicitud no está pendiente de revisión');
    }

    const adminUser = request.company.memberships[0]?.user;

    if (input.status === 'REJECTED') {
      const rejected = await this.prisma.planUpgradeRequest.update({
        where: { id: requestId },
        data: {
          status: PlanUpgradeStatus.REJECTED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes,
        },
      });

      if (adminUser) {
        await this.emailService.sendSubscriptionRejected(adminUser.email, request.company.name);
      }

      return {
        requestId: rejected.id,
        status: rejected.status,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const currentSubscription = await tx.subscription.findUnique({
        where: { companyId: request.companyId },
      });

      if (!currentSubscription) {
        throw new NotFoundException('Suscripción no encontrada');
      }

      const plan = await tx.plan.findUnique({
        where: { id: request.planId },
      });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (plan?.billingCycle === 'YEARLY' ? 12 : 1));

      const subscription = await tx.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planId: request.planId,
          billingCycle: plan?.billingCycle || 'MONTHLY',
          startDate,
          endDate,
          status: SubscriptionStatus.ACTIVE,
          provider: request.provider || PaymentProvider.CASH,
        },
      });

      await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          provider: request.provider || PaymentProvider.CASH,
          transactionId: `upgrade-${request.id}`,
          amount: request.amount || '0',
          currency: request.currency || 'PEN',
          status: 'SUCCEEDED',
          providerPayload: {
            planUpgradeRequestId: request.id,
          },
        },
      });

      const approved = await tx.planUpgradeRequest.update({
        where: { id: requestId },
        data: {
          status: PlanUpgradeStatus.APPROVED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes,
        },
      });

      return { approved, subscription };
    });

    if (adminUser) {
      await this.notificationsService.create({
        userId: adminUser.id,
        companyId: request.companyId,
        type: NotificationType.SUBSCRIPTION_APPROVED,
        channel: NotificationChannel.IN_APP,
        title: 'Plan actualizado',
        message: `Tu cambio al plan ${request.plan.name} ha sido aprobado.`,
      });

      await this.emailService.sendSubscriptionApproved(adminUser.email, request.company.name);
    }

    return {
      requestId: result.approved.id,
      status: result.approved.status,
    };
  }
}