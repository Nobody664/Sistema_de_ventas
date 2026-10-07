import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { CompanyStatus, PaymentProvider, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
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

  private buildCheckoutResponse(request: any, settings: any) {
    return {
      requestId: request.id,
      status: request.status,
      plan: {
        code: request.plan.code,
        name: request.plan.name,
        billingCycle: request.plan.billingCycle,
        amount: request.amount,
      },
      paymentMethod: request.provider,
      paymentSetting: settings
        ? {
            provider: settings.provider,
            qrImageBase64: settings.qrImageBase64,
            accountNumber: settings.accountNumber,
            accountName: settings.accountName,
            instructions: settings.instructions,
          }
        : null,
    };
  }

  private async createOrReuse(
    create: () => Promise<any>,
    idempotencyKey: string | undefined,
    provider: PaymentProvider,
    companyId?: string,
  ) {
    try {
      return { request: await create() };
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002' && idempotencyKey) {
        const existing = await this.prisma.checkoutRequest.findFirst({
          where: { idempotencyKey, ...(companyId ? { companyId } : {}) },
          include: { plan: true },
        });
        if (existing) {
          const existingSettings = await this.prisma.paymentSetting.findFirst({
            where: { provider: existing.provider },
          });
          return { request: existing, existingSettings };
        }
      }
      throw err;
    }
  }

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
      if (existingPendingRequest?.plan.code === input.planCode) {
        const settings = await this.prisma.paymentSetting.findFirst({
          where: { provider: existingPendingRequest.provider },
        });
        return this.buildCheckoutResponse(existingPendingRequest, settings);
      }

      const plan = await this.prisma.plan.findUnique({
        where: { code: input.planCode },
      });
      if (!plan?.isActive) {
        throw new NotFoundException('Plan no encontrado');
      }

      const settings = await this.prisma.paymentSetting.findFirst({
        where: { provider: input.paymentMethod },
      });
      if (!settings?.isEnabled) {
        throw new ConflictException('Método de pago no disponible');
      }

      const { request, existingSettings } = await this.createOrReuse(
        () =>
          this.prisma.checkoutRequest.create({
            data: {
              companyId: input.companyId,
              fullName: company.name,
              companyName: company.name,
              email: '',
              passwordHash: '',
              planId: plan.id,
              provider: input.paymentMethod,
              amount: (plan.billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly).toString(),
              currency: 'PEN',
              status: 'DRAFT',
              idempotencyKey: input.idempotencyKey ?? undefined,
            },
            include: { plan: true },
          }),
        input.idempotencyKey,
        input.paymentMethod,
        input.companyId,
      );

      return this.buildCheckoutResponse(request, existingSettings ?? settings);
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

      if (existingOpenRequest.plan.code === input.planCode) {
        return this.buildCheckoutResponse(existingOpenRequest, settings);
      }
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: input.planCode },
    });
    if (!plan?.isActive) {
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

    const { fullName, companyName, email } = input as {
      fullName: string;
      companyName: string;
      email: string;
    };

    const passwordHash = await argon2.hash(input.password);
    const { request, existingSettings } = await this.createOrReuse(
      () =>
        this.prisma.checkoutRequest.create({
          data: {
            fullName,
            companyName,
            email,
            passwordHash,
            planId: plan.id,
            provider: input.paymentMethod,
            amount: (plan.billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly).toString(),
            currency: 'PEN',
            status: 'DRAFT',
            idempotencyKey: input.idempotencyKey ?? undefined,
          },
          include: { plan: true },
        }),
      input.idempotencyKey,
      input.paymentMethod,
    );

    return this.buildCheckoutResponse(request, existingSettings ?? settings);
  }

  async submitProof(requestId: string, companyId: string | undefined, input: SubmitCheckoutProofDto) {
    if (!input.imageBase64.startsWith('data:image/')) {
      throw new BadRequestException('Formato de comprobante inválido');
    }

    const request = await this.prisma.checkoutRequest.findFirst({
      where: { id: requestId, ...(companyId ? { companyId } : {}) },
      include: { plan: true },
    });
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    if (request.companyId && !companyId) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    if (request.status !== 'DRAFT') {
      throw new ConflictException('La solicitud ya fue enviada o revisada');
    }

    const updated = await this.prisma.checkoutRequest.updateMany({
      where: { id: requestId, status: 'DRAFT', ...(companyId ? { companyId } : {}) },
      data: {
        proofImageBase64: input.imageBase64,
        paymentDate: input.paymentDate ?? new Date(),
        submittedAt: new Date(),
        status: 'SUBMITTED',
      },
    });
    if (updated.count === 0) {
      throw new ConflictException('La solicitud ya fue enviada o revisada');
    }

    await this.emailService.sendPaymentProofReceived(
      request.email,
      request.companyName || '',
      request.plan.name,
    );

    return {
      requestId: request.id,
      status: 'SUBMITTED',
    };
  }

  async getPending() {
    return this.prisma.checkoutRequest.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        email: true,
        provider: true,
        amount: true,
        currency: true,
        status: true,
        proofImageBase64: true,
        reviewNotes: true,
        reviewedBy: true,
        reviewedAt: true,
        createdAt: true,
        submittedAt: true,
        plan: {
          select: { code: true, name: true },
        },
      },
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
      const rejected = await this.prisma.checkoutRequest.updateMany({
        where: { id: requestId, status: 'SUBMITTED' },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes,
        },
      });
      if (rejected.count === 0) {
        throw new ConflictException('La solicitud no está pendiente de revisión');
      }

      await this.emailService.sendSubscriptionRejected(request.email, request.companyName || '');

      return {
        requestId: requestId,
        status: 'REJECTED',
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
      const claimed = await tx.checkoutRequest.updateMany({
        where: { id: requestId, status: 'SUBMITTED' },
        data: {
          status: 'REVIEWING',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException('La solicitud no está pendiente de revisión');
      }

      const existingSubscription = await tx.subscription.findUnique({
        where: { companyId: request.companyId },
      });

      await tx.company.update({
        where: { id: request.companyId },
        data: { status: CompanyStatus.ACTIVE },
      });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (request.plan.billingCycle === 'YEARLY' ? 12 : 1));

      const subscriptionData = {
        planId: request.planId,
        billingCycle: request.plan.billingCycle,
        startDate,
        endDate,
        status: SubscriptionStatus.ACTIVE,
        provider: request.provider,
      };
      const subscription = existingSubscription
        ? await tx.subscription.update({
            where: { id: existingSubscription.id },
            data: subscriptionData,
          })
        : await tx.subscription.create({
            data: {
              ...subscriptionData,
              companyId: request.companyId,
            },
          });

      await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          provider: request.provider,
          providerPaymentId: `upgrade-${request.id}`,
          amount: new Prisma.Decimal(request.amount),
          currency: request.currency,
          status: 'SUCCEEDED',
          providerPayload: {
            checkoutRequestId: request.id,
          },
        },
      });

      await tx.checkoutRequest.updateMany({
        where: { id: requestId },
        data: { status: 'APPROVED' },
      });

      return { subscription };
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
      requestId: requestId,
      status: 'APPROVED',
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
      const claimed = await tx.checkoutRequest.updateMany({
        where: { id: requestId, status: 'SUBMITTED' },
        data: {
          status: 'REVIEWING',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException('La solicitud no está pendiente de revisión');
      }

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
      endDate.setMonth(endDate.getMonth() + (request.plan.billingCycle === 'YEARLY' ? 12 : 1));

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
          amount: new Prisma.Decimal(request.amount),
          currency: request.currency,
          status: 'SUCCEEDED',
          providerPayload: {
            checkoutRequestId: request.id,
          },
        },
      });

      await tx.checkoutRequest.updateMany({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          companyId: company.id,
          userId: user.id,
          subscriptionId: subscription.id,
        },
      });

      return { company, user };
    });

    await this.emailService.sendSubscriptionApproved(request.email, request.companyName);

    return {
      requestId: requestId,
      status: 'APPROVED',
      companyId: result.company.id,
    };
  }
}
