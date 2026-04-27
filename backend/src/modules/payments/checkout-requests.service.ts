import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { CompanyStatus, PaymentProvider, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { EmailService } from '@/modules/email/email.service';
import { NotificationsService, NotificationType, NotificationChannel } from '@/modules/notifications/notifications.service';
import { CheckoutReviewStatus, CreateCheckoutRequestDto, SubmitCheckoutProofDto } from './dto/checkout-requests.dto';

const OFFLINE_PROVIDERS: PaymentProvider[] = [
  PaymentProvider.YAPE,
  PaymentProvider.PLIN,
  PaymentProvider.TRANSFER,
];

@Injectable()
export class CheckoutRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createRequest(input: CreateCheckoutRequestDto) {
    if (!OFFLINE_PROVIDERS.includes(input.paymentMethod)) {
      throw new BadRequestException('Método de pago no soportado para checkout offline');
    }

    const isAuthenticated = !!input.companyId;

    if (isAuthenticated) {
      const company = await this.prisma.company.findUnique({
        where: { id: input.companyId },
      });
      if (!company) {
        throw new NotFoundException('Empresa no encontrada');
      }

      const existingPendingRequest = await this.prisma.checkoutRequest.findFirst({
        where: {
          companyId: input.companyId,
          status: { in: ['DRAFT', 'SUBMITTED'] },
        },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      });
      if (existingPendingRequest) {
        const settings = await this.prisma.paymentSetting.findFirst({
          where: { companyId: input.companyId, provider: existingPendingRequest.provider },
        });
        return {
          requestId: existingPendingRequest.id,
          status: existingPendingRequest.status,
          plan: {
            code: existingPendingRequest.plan.code,
            name: existingPendingRequest.plan.name,
            priceMonthly: existingPendingRequest.plan.priceMonthly.toString(),
          },
          paymentMethod: existingPendingRequest.provider,
          paymentSetting: settings ? {
            provider: settings.provider,
            qrImageBase64: settings.qrImageBase64,
            accountNumber: settings.accountNumber,
            accountName: settings.accountName,
            instructions: settings.instructions,
          } : null,
        };
      }

      const plan = await this.prisma.plan.findUnique({
        where: { code: input.planCode },
      });
      if (!plan) {
        throw new NotFoundException('Plan no encontrado');
      }

      const settings = await this.prisma.paymentSetting.findFirst({
        where: { provider: input.paymentMethod },
      });
      if (!settings?.isEnabled) {
        throw new ConflictException('Método de pago no disponible');
      }

      const request = await this.prisma.checkoutRequest.create({
        data: {
          companyId: input.companyId,
          fullName: company.name,
          companyName: company.name,
          email: '',
          passwordHash: '',
          planId: plan.id,
          provider: input.paymentMethod,
          amount: plan.priceMonthly.toString(),
          currency: 'PEN',
          status: 'DRAFT',
        },
        include: { plan: true },
      });

      return {
        requestId: request.id,
        status: request.status,
        plan: {
          code: request.plan.code,
          name: request.plan.name,
          priceMonthly: request.plan.priceMonthly.toString(),
        },
        paymentMethod: request.provider,
        paymentSetting: {
          provider: settings.provider,
          qrImageBase64: settings.qrImageBase64,
          accountNumber: settings.accountNumber,
          accountName: settings.accountName,
          instructions: settings.instructions,
        },
      };
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }

    const existingOpenRequest = await this.prisma.checkoutRequest.findFirst({
      where: {
        email: input.email,
        status: { in: ['DRAFT', 'SUBMITTED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (existingOpenRequest) {
      const settings = await this.prisma.paymentSetting.findFirst({
        where: { provider: existingOpenRequest.provider },
      });
      if (!settings?.isEnabled) {
        throw new ConflictException('Método de pago no disponible');
      }

      return {
        requestId: existingOpenRequest.id,
        status: existingOpenRequest.status,
        plan: {
          code: existingOpenRequest.plan.code,
          name: existingOpenRequest.plan.name,
          priceMonthly: existingOpenRequest.plan.priceMonthly.toString(),
        },
        paymentMethod: existingOpenRequest.provider,
        paymentSetting: {
          provider: settings.provider,
          qrImageBase64: settings.qrImageBase64,
          accountNumber: settings.accountNumber,
          accountName: settings.accountName,
          instructions: settings.instructions,
        },
      };
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: input.planCode },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }

const settings = await this.prisma.paymentSetting.findFirst({
        where: { provider: input.paymentMethod },
      });
    if (!settings?.isEnabled) {
      throw new ConflictException('Método de pago no disponible');
    }

    if (!input.fullName || !input.companyName || !input.email || !input.password) {
      throw new BadRequestException('Para registro sin autenticación se requiere: fullName, companyName, email y password');
    }

    const passwordHash = await argon2.hash(input.password);
    const request = await this.prisma.checkoutRequest.create({
      data: {
        fullName: input.fullName,
        companyName: input.companyName,
        email: input.email,
        passwordHash,
        planId: plan.id,
        provider: input.paymentMethod,
        amount: plan.priceMonthly.toString(),
        currency: 'PEN',
        status: 'DRAFT',
      },
      include: { plan: true },
    });

    return {
      requestId: request.id,
      status: request.status,
      plan: {
        code: request.plan.code,
        name: request.plan.name,
        priceMonthly: request.plan.priceMonthly.toString(),
      },
      paymentMethod: request.provider,
      paymentSetting: {
        provider: settings.provider,
        qrImageBase64: settings.qrImageBase64,
        accountNumber: settings.accountNumber,
        accountName: settings.accountName,
        instructions: settings.instructions,
      },
    };
  }

  async submitProof(requestId: string, companyId: string, input: SubmitCheckoutProofDto) {
    if (!input.imageBase64.startsWith('data:image/')) {
      throw new BadRequestException('Formato de comprobante invÃ¡lido');
    }

    const request = await this.prisma.checkoutRequest.findUnique({
      where: { id: requestId },
      include: { plan: true },
    });
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    if (request.companyId !== companyId) {
      throw new ForbiddenException('No tienes permiso para modificar esta solicitud');
    }
    if (request.status !== 'DRAFT') {
      throw new ConflictException('La solicitud ya fue enviada o revisada');
    }

    const updated = await this.prisma.checkoutRequest.update({
      where: { id: requestId },
      data: {
        proofImageBase64: input.imageBase64,
        paymentDate: input.paymentDate ?? new Date(),
        submittedAt: new Date(),
        status: 'SUBMITTED',
      },
    });

    await this.emailService.sendPaymentProofReceived(
      request.email,
      request.companyName || '',
      request.plan.name,
    );

    return {
      requestId: updated.id,
      status: updated.status,
    };
  }

  async getPending() {
    return this.prisma.checkoutRequest.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { createdAt: 'asc' },
      include: { plan: true },
    });
  }

  async review(requestId: string, reviewerId: string, input: { status: CheckoutReviewStatus; reviewNotes?: string }) {
    const request = await this.prisma.checkoutRequest.findUnique({
      where: { id: requestId },
      include: { plan: true },
    });
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    if (request.status !== 'SUBMITTED') {
      throw new ConflictException('La solicitud no está pendiente de revisión');
    }

    if (input.status === CheckoutReviewStatus.REJECTED) {
      const rejected = await this.prisma.checkoutRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes,
        },
      });

      await this.emailService.sendSubscriptionRejected(request.email, request.companyName || '');

      return {
        requestId: rejected.id,
        status: rejected.status,
      };
    }

    const hasExistingCompany = !!request.companyId;

    if (hasExistingCompany) {
      return this.handleUpgradeApproval(requestId, reviewerId, request, input.reviewNotes);
    }

    return this.handleNewCustomerApproval(requestId, reviewerId, request, input.reviewNotes);
  }

  private async handleUpgradeApproval(
    requestId: string,
    reviewerId: string,
    request: any,
    reviewNotes?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existingSubscription = await tx.subscription.findUnique({
        where: { companyId: request.companyId },
      });

      if (!existingSubscription) {
        throw new NotFoundException('Suscripción no encontrada');
      }

      await tx.company.update({
        where: { id: request.companyId },
        data: { status: CompanyStatus.ACTIVE },
      });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const subscription = await tx.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          planId: request.planId,
          billingCycle: request.plan.billingCycle,
          startDate,
          endDate,
          status: 'ACTIVE',
          provider: request.provider,
        },
      });

      await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          provider: request.provider,
          providerPaymentId: `upgrade-${request.id}`,
          amount: request.plan.priceMonthly,
          currency: request.currency,
          status: 'SUCCEEDED',
          providerPayload: {
            checkoutRequestId: request.id,
          },
        },
      });

      const approved = await tx.checkoutRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes,
        },
      });

      return { approved, subscription };
    });

    const adminUsers = await this.prisma.user.findMany({
      where: {
        memberships: {
          some: {
            companyId: request.companyId,
            role: 'COMPANY_ADMIN',
            isActive: true,
          },
        },
      },
    });

    for (const admin of adminUsers) {
      await this.notificationsService.create({
        userId: admin.id,
        companyId: request.companyId,
        type: 'PLAN_UPGRADED' as any,
        channel: 'IN_APP' as any,
        title: 'Plan actualizado',
        message: `Tu cambio al plan ${request.plan.name} ha sido aprobado.`,
      });
    }

    await this.emailService.sendSubscriptionApproved(
      request.email || adminUsers[0]?.email || '',
      request.companyName,
    );

    return {
      requestId: result.approved.id,
      status: result.approved.status,
      subscriptionId: result.subscription.id,
    };
  }

  private async handleNewCustomerApproval(
    requestId: string,
    reviewerId: string,
    request: any,
    reviewNotes?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: request.email },
        select: { id: true },
      });
      if (existingUser) {
        throw new ConflictException('El correo electrónico ya está registrado.');
      }

      const slugBase = request.companyName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

      const company = await tx.company.create({
        data: {
          name: request.companyName,
          slug: `${slugBase}-${Date.now().toString().slice(-6)}`,
          status: 'ACTIVE',
        },
      });

      const user = await tx.user.create({
        data: {
          email: request.email,
          fullName: request.fullName,
          passwordHash: request.passwordHash,
          globalRole: 'USER',
          isActive: true,
          memberships: {
            create: {
              companyId: company.id,
              role: 'COMPANY_ADMIN',
              isActive: true,
            },
          },
        },
      });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const subscription = await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: request.planId,
          status: 'ACTIVE',
          billingCycle: request.plan.billingCycle,
          startDate,
          endDate,
          autoRenew: true,
          provider: request.provider,
        },
      });

      await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          provider: request.provider,
          transactionId: `proof-${request.id}`,
          amount: request.plan.priceMonthly,
          currency: request.currency,
          status: 'SUCCEEDED',
          providerPayload: {
            checkoutRequestId: request.id,
          },
        },
      });

      const approved = await tx.checkoutRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes,
          companyId: company.id,
          userId: user.id,
          subscriptionId: subscription.id,
        },
      });

      return { approved, company, user };
    });

    await this.emailService.sendSubscriptionApproved(request.email, request.companyName);

    return {
      requestId: result.approved.id,
      status: result.approved.status,
      companyId: result.approved.companyId,
    };
  }
}
