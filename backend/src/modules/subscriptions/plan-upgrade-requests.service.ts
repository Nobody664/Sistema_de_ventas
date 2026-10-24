import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  PaymentProvider,
  PlanUpgradeStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { evaluateProfile } from "@/common/helpers/profile-completeness.helper";
import { EmailService } from "@/modules/email/email.service";
import {
  NotificationsService,
  NotificationType,
  NotificationChannel,
} from "@/modules/notifications/notifications.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { parseImageDataUrl } from "@/common/helpers/image.helper";
import { subscriptionEndDate } from "@/common/helpers/subscription-period.helper";
import {
  CreatePlanUpgradeRequestDto,
  SubmitUpgradeProofDto,
  ReviewPlanUpgradeDto,
} from "./dto/plan-upgrade.dto";

const OFFLINE_PROVIDERS: PaymentProvider[] = [
  PaymentProvider.YAPE,
  PaymentProvider.PLIN,
  PaymentProvider.TRANSFER,
];

@Injectable()
export class PlanUpgradeRequestsService {
  private readonly logger = new Logger(PlanUpgradeRequestsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly planCapabilities: PlanCapabilitiesService,
  ) {}

  private buildUpgradeResponse(currentPlan: any, request: any, settings: any) {
    return {
      requestId: request.id,
      status: request.status,
      currentPlan: {
        code: currentPlan.code,
        name: currentPlan.name,
      },
      newPlan: {
        code: request.plan.code,
        name: request.plan.name,
        priceMonthly: request.plan.priceMonthly.toString(),
        priceYearly: request.plan.priceYearly.toString(),
      },
      paymentMethod: request.provider,
      billingCycle: request.billingCycle,
      paymentSettings: settings
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
    companyId: string,
  ) {
    try {
      return { request: await create(), reused: false };
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        idempotencyKey
      ) {
        const existing = await this.prisma.planUpgradeRequest.findFirst({
          where: { idempotencyKey, companyId },
          include: { plan: true },
        });
        if (existing) {
          const existingSettings = existing.provider
            ? await this.prisma.paymentSetting.findFirst({
                where: { provider: existing.provider, isEnabled: true },
              })
            : undefined;
          return { request: existing, existingSettings, reused: true };
        }
      }
      throw err;
    }
  }

  async createRequest(companyId: string, input: CreatePlanUpgradeRequestDto) {
    if (!OFFLINE_PROVIDERS.includes(input.paymentMethod)) {
      throw new BadRequestException(
        "Método de pago no soportado para upgrade offline",
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { subscriptions: { include: { plan: true }, take: 1 } },
    });

    if (!company) {
      throw new NotFoundException("Empresa no encontrada");
    }

    const currentSubscription = company.subscriptions?.[0];
    if (!currentSubscription) {
      throw new BadRequestException(
        "La empresa no tiene una suscripción activa",
      );
    }

    const newPlan = await this.prisma.plan.findUnique({
      where: { code: input.newPlanCode },
    });

    if (!newPlan) {
      throw new NotFoundException("Plan no encontrado");
    }

    if (newPlan.id === currentSubscription.planId) {
      throw new ConflictException("Ya tienes ese plan activo");
    }

    if (newPlan.code !== "FREE") {
      const profile = evaluateProfile({
        taxId: company.taxId,
        legalName: company.legalName,
        address: company.address,
        phone: company.phone,
        email: company.email,
      });
      if (!profile.complete) {
        throw new BadRequestException(
          `Para contratar un plan de pago tu empresa debe tener el perfil completo (RUC, Razón Social, Dirección, Teléfono y Email). Campos pendientes: ${profile.missingFields.join(", ")}.`,
        );
      }
    }

    const settings = await this.prisma.paymentSetting.findFirst({
      where: { provider: input.paymentMethod, isEnabled: true },
    });

    if (!settings) {
      throw new ConflictException("Método de pago no disponible");
    }

    const billingCycle = input.billingCycle || "MONTHLY";
    const price =
      billingCycle === "MONTHLY" ? newPlan.priceMonthly : newPlan.priceYearly;

    const existingPendingRequest =
      await this.prisma.planUpgradeRequest.findFirst({
        where: {
          companyId,
          status: PlanUpgradeStatus.PENDING,
        },
        include: { plan: true },
      });

    if (existingPendingRequest) {
      if (
        existingPendingRequest.planId !== newPlan.id ||
        existingPendingRequest.billingCycle !== billingCycle ||
        existingPendingRequest.provider !== input.paymentMethod
      )
        throw new ConflictException(
          "Existe una solicitud pendiente con otras condiciones; revísala antes de crear otra",
        );
      return this.buildUpgradeResponse(
        currentSubscription.plan,
        existingPendingRequest,
        settings,
      );
    }

    const result = await this.createOrReuse(
      () =>
        this.prisma.planUpgradeRequest.create({
          data: {
            companyId,
            currentPlanId: currentSubscription.planId,
            planId: newPlan.id,
            provider: input.paymentMethod,
            billingCycle,
            amount: price.toString(),
            currency: "PEN",
            status: PlanUpgradeStatus.PENDING,
            idempotencyKey: input.idempotencyKey ?? undefined,
          },
          include: { plan: true },
        }),
      input.idempotencyKey,
      companyId,
    );

    if (!result.reused)
      await this.notificationsService
        .notifySuperAdmins({
          type: NotificationType.PLAN_UPGRADE_REQUEST,
          title: "Nueva solicitud de cambio de plan",
          message: `${company.name} solicitó el plan ${newPlan.name}.`,
          companyId,
          data: { planUpgradeRequestId: result.request.id, companyId },
          actionUrl: "/platform/upgrade-requests",
        })
        .catch((error: unknown) =>
          this.logger.warn(
            `No se pudo notificar la solicitud: ${String(error)}`,
          ),
        );

    return this.buildUpgradeResponse(
      currentSubscription.plan,
      result.request,
      result.existingSettings ?? settings,
    );
  }

  async submitProof(
    requestId: string,
    companyId: string,
    input: SubmitUpgradeProofDto,
  ) {
    const proofImage = (await parseImageDataUrl(input.imageBase64)).dataUrl;

    const request = await this.prisma.planUpgradeRequest.findFirst({
      where: { id: requestId, companyId },
      include: { plan: true, company: true },
    });

    if (!request) {
      throw new NotFoundException("Solicitud no encontrada");
    }

    if (request.status !== PlanUpgradeStatus.PENDING) {
      throw new ConflictException("La solicitud ya fue enviada o revisada");
    }

    const updated = await this.prisma.planUpgradeRequest.updateMany({
      where: { id: requestId, companyId, status: PlanUpgradeStatus.PENDING },
      data: {
        proofImageBase64: proofImage,
        paymentDate: input.paymentDate
          ? new Date(input.paymentDate)
          : new Date(),
        submittedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException("La solicitud ya fue enviada o revisada");
    }

    await this.notificationsService
      .notifySuperAdmins({
        type: NotificationType.PAYMENT_PROOF_PENDING,
        title: "Comprobante de pago recibido",
        message: `${request.company.name} envió el comprobante para el plan ${request.plan.name}.`,
        data: {
          planUpgradeRequestId: request.id,
          companyId: request.companyId,
        },
        actionUrl: "/platform/upgrade-requests",
        companyId: request.companyId,
      })
      .catch((error: unknown) =>
        this.logger.warn(
          `No se pudo notificar el comprobante: ${String(error)}`,
        ),
      );

    return {
      requestId: request.id,
      status: PlanUpgradeStatus.PENDING,
    };
  }

  async getPending() {
    return this.prisma.planUpgradeRequest.findMany({
      where: { status: PlanUpgradeStatus.PENDING },
      orderBy: { createdAt: "asc" },
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
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
  }

  async getPendingRequest(companyId: string) {
    const request = await this.prisma.planUpgradeRequest.findFirst({
      where: {
        companyId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
    return request;
  }

  async review(
    requestId: string,
    reviewerId: string,
    input: ReviewPlanUpgradeDto,
  ) {
    if (!["APPROVED", "REJECTED"].includes(input.status))
      throw new BadRequestException("Decisión de revisión inválida");
    const request = await this.prisma.planUpgradeRequest.findUnique({
      where: { id: requestId },
      include: {
        company: {
          include: {
            memberships: {
              include: { user: true },
              where: { role: "COMPANY_ADMIN" },
            },
          },
        },
        plan: true,
      },
    });

    if (!request) {
      throw new NotFoundException("Solicitud no encontrada");
    }

    if (request.status !== PlanUpgradeStatus.PENDING) {
      throw new ConflictException("La solicitud no está pendiente de revisión");
    }

    const adminUser = request.company.memberships[0]?.user;
    const cycle = request.billingCycle ?? input.legacyBillingCycle;
    if (input.status !== "REJECTED" && !cycle)
      throw new ConflictException(
        "La solicitud histórica requiere conciliar explícitamente su ciclo de facturación",
      );
    if (
      input.status === "APPROVED" &&
      !request.billingCycle &&
      (!input.reviewNotes || input.reviewNotes.trim().length < 5)
    )
      throw new BadRequestException(
        "Documenta la conciliación del ciclo histórico",
      );
    if (
      input.status === "APPROVED" &&
      (request.amount === null ||
        !Number.isFinite(Number(request.amount)) ||
        Number(request.amount) < 0 ||
        (request.plan.code !== "FREE" && Number(request.amount) === 0))
    )
      throw new ConflictException(
        "El importe contratado requiere conciliación",
      );
    if (
      request.billingCycle &&
      input.legacyBillingCycle &&
      request.billingCycle !== input.legacyBillingCycle
    )
      throw new BadRequestException("No puedes cambiar el ciclo contratado");

    if (input.status === "REJECTED") {
      const rejected = await this.prisma.planUpgradeRequest.updateMany({
        where: { id: requestId, status: PlanUpgradeStatus.PENDING },
        data: {
          status: PlanUpgradeStatus.REJECTED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes,
        },
      });
      if (rejected.count === 0) {
        throw new ConflictException(
          "La solicitud no está pendiente de revisión",
        );
      }

      if (adminUser) {
        await this.emailService.sendSubscriptionRejected(
          adminUser.email,
          request.company.name,
        );

        await this.notificationsService
          .create({
            userId: adminUser.id,
            companyId: request.companyId,
            type: NotificationType.SUBSCRIPTION_REJECTED,
            channel: NotificationChannel.IN_APP,
            title: "Solicitud de plan rechazada",
            message: `Tu solicitud de cambio al plan ${request.plan.name} fue rechazada.`,
          })
          .catch(() => undefined);
      }

      await this.notificationsService
        .notifySuperAdmins({
          type: NotificationType.SUBSCRIPTION_REJECTED,
          title: "Solicitud rechazada",
          message: `La solicitud de ${request.company.name} para el plan ${request.plan.name} fue rechazada.`,
          companyId: request.companyId,
          actionUrl: "/platform/upgrade-requests",
          data: { planUpgradeRequestId: request.id },
        })
        .catch((error: unknown) =>
          this.logger.warn(
            `No se pudo notificar la revisión: ${String(error)}`,
          ),
        );
      return { requestId, status: "REJECTED" };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.planUpgradeRequest.updateMany({
        where: { id: requestId, status: PlanUpgradeStatus.PENDING },
        data: {
          status: PlanUpgradeStatus.APPROVED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException(
          "La solicitud no está pendiente de revisión",
        );
      }

      if (request.plan.code !== "FREE") {
        const profile = evaluateProfile({
          taxId: request.company.taxId,
          legalName: request.company.legalName,
          address: request.company.address,
          phone: request.company.phone,
          email: request.company.email,
        });
        if (!profile.complete) {
          throw new BadRequestException(
            `No se puede aprobar: la empresa no tiene el perfil completo (pendientes: ${profile.missingFields.join(", ")}).`,
          );
        }
      }

      const currentSubscription = await tx.subscription.findUnique({
        where: { companyId: request.companyId },
      });

      if (!currentSubscription) {
        throw new NotFoundException("Suscripción no encontrada");
      }

      const plan = await tx.plan.findUnique({
        where: { id: request.planId },
      });

      const startDate = new Date();
      const endDate = subscriptionEndDate(startDate, cycle!);

      const subscription = await tx.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planId: request.planId,
          billingCycle: cycle!,
          startDate,
          endDate,
          status: SubscriptionStatus.ACTIVE,
          provider: request.provider || PaymentProvider.CASH,
        },
      });

      await tx.company.update({
        where: { id: request.companyId },
        data: { status: "ACTIVE" },
      });

      await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          provider: request.provider || PaymentProvider.CASH,
          transactionId: `upgrade-${request.id}`,
          amount: request.amount || "0",
          currency: request.currency || "PEN",
          status: "SUCCEEDED",
          paidAt: request.paymentDate ?? new Date(),
          providerPayload: {
            planUpgradeRequestId: request.id,
          },
        },
      });

      return { subscription };
    });

    await this.planCapabilities.invalidate(request.companyId);

    if (adminUser) {
      await this.notificationsService.create({
        userId: adminUser.id,
        companyId: request.companyId,
        type: NotificationType.SUBSCRIPTION_APPROVED,
        channel: NotificationChannel.IN_APP,
        title: "Plan actualizado",
        message: `Tu cambio al plan ${request.plan.name} ha sido aprobado.`,
      });

      await this.emailService.sendSubscriptionApproved(
        adminUser.email,
        request.company.name,
      );
    }

    await this.notificationsService
      .notifySuperAdmins({
        type: NotificationType.PAYMENT_RECEIVED,
        title: "Pago y cambio de plan aprobados",
        message: `${request.company.name}: cambio al plan ${request.plan.name} aprobado por ${request.currency} ${request.amount}.`,
        companyId: request.companyId,
        actionUrl: "/platform/finanzas",
        data: { planUpgradeRequestId: request.id },
      })
      .catch((error: unknown) =>
        this.logger.warn(`No se pudo notificar el pago: ${String(error)}`),
      );
    return { requestId, status: "APPROVED" };
  }
}
