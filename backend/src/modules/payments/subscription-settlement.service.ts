import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { BillingCycle, Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { subscriptionEndDate } from "@/common/helpers/subscription-period.helper";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { CacheService } from "@/cache/cache.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { EmailService, EmailTemplate } from "@/modules/email/email.service";
import { ConfirmSubscriptionPaymentDto } from "./dto/confirm-subscription-payment.dto";
import { MercadoPagoPayment } from "./mercado-pago.gateway";

export interface MercadoPagoCheckoutSnapshot {
  kind: "MERCADOPAGO_CHECKOUT";
  companyId: string;
  planId: string;
  billingCycle: BillingCycle;
}

function checkoutSnapshot(
  value: Prisma.JsonValue,
): MercadoPagoCheckoutSnapshot {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.kind === "MERCADOPAGO_CHECKOUT" &&
    typeof value.companyId === "string" &&
    typeof value.planId === "string" &&
    (value.billingCycle === "MONTHLY" || value.billingCycle === "YEARLY")
  ) {
    return {
      kind: value.kind,
      companyId: value.companyId,
      planId: value.planId,
      billingCycle: value.billingCycle,
    };
  }
  throw new BadRequestException(
    "El pago no tiene una intención de cobro verificable",
  );
}

@Injectable()
export class SubscriptionSettlementService {
  private readonly logger = new Logger(SubscriptionSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: PlanCapabilitiesService,
    private readonly cache: CacheService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly email?: EmailService,
  ) {}

  async confirmManual(
    id: string,
    actor: AuthUser,
    input: ConfirmSubscriptionPaymentDto,
  ) {
    if (!actor.roles.includes("SUPER_ADMIN"))
      throw new ForbiddenException(
        "Solo SUPER_ADMIN puede confirmar cobros de plataforma",
      );
    if (!input.reason?.trim() || input.reason.trim().length < 3)
      throw new BadRequestException("Indica el motivo de la confirmación");
    const paidAt = input.paymentDate ? new Date(input.paymentDate) : new Date();
    if (
      Number.isNaN(paidAt.getTime()) ||
      paidAt.getTime() > Date.now() + 60_000
    )
      throw new BadRequestException("Fecha de pago inválida");
    const result = await this.transaction(async (tx) => {
      const reviewer = await tx.user.findFirst({
        where: { id: actor.sub, globalRole: "SUPER_ADMIN", isActive: true },
        select: { id: true },
      });
      if (!reviewer)
        throw new ForbiddenException("El revisor no tiene permisos vigentes");
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { subscription: { include: { company: true } } },
      });
      if (!payment) throw new NotFoundException("Pago no encontrado");
      if (
        !["CASH", "TRANSFER", "YAPE", "PLIN", "CARD"].includes(payment.provider)
      )
        throw new BadRequestException(
          "El cobro debe ser confirmado por su proveedor",
        );
      if (payment.status === "SUCCEEDED")
        return {
          id,
          companyId: payment.subscription.companyId,
          alreadyProcessed: true,
        };
      if (payment.status !== "PENDING")
        throw new ConflictException("El pago no está pendiente");
      if (payment.amount.lte(0))
        throw new BadRequestException("El importe del pago debe ser positivo");
      const claimed = await tx.payment.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "SUCCEEDED",
          paidAt,
          providerPaymentId: `manual-${id}`,
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException("El pago ya fue procesado");
      const subscription = payment.subscription;
      const start =
        subscription.status === "ACTIVE" && subscription.endDate > new Date()
          ? subscription.endDate
          : new Date();
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          endDate: subscriptionEndDate(start, subscription.billingCycle),
        },
      });
      if (subscription.company.status !== "SUSPENDED")
        await tx.company.update({
          where: { id: subscription.companyId },
          data: { status: "ACTIVE" },
        });
      await tx.platformAuditLog.create({
        data: {
          actorId: reviewer.id,
          action: "UPDATE",
          entity: "Payment",
          entityId: id,
          changes: {
            source: "MANUAL_CONFIRMATION",
            reason: input.reason.trim(),
            paidAt: paidAt.toISOString(),
            companyId: subscription.companyId,
          },
        },
      });
      return { id, companyId: subscription.companyId, alreadyProcessed: false };
    });
    await this.invalidate(result.companyId);
    if (!result.alreadyProcessed) await this.announce(result.id);
    return {
      ...result,
      message: result.alreadyProcessed
        ? "El pago ya estaba confirmado"
        : "Cobro confirmado",
    };
  }

  async confirmMercadoPago(verified: MercadoPagoPayment) {
    if (
      verified.status !== "approved" ||
      !verified.reference ||
      !verified.paidAt
    )
      throw new BadRequestException("El proveedor no confirmó el pago");
    const result = await this.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { transactionId: verified.reference! },
        include: { subscription: { include: { company: true } } },
      });
      if (!payment || payment.provider !== "MERCADOPAGO")
        throw new NotFoundException(
          "No existe una intención de cobro asociada",
        );
      const snapshot = checkoutSnapshot(payment.providerPayload);
      if (
        snapshot.companyId !== payment.subscription.companyId ||
        payment.currency !== verified.currency ||
        !payment.amount.equals(verified.amount) ||
        payment.amount.lte(0)
      ) {
        throw new BadRequestException(
          "El pago del proveedor no coincide con el cobro esperado",
        );
      }
      if (payment.status === "SUCCEEDED") {
        if (payment.providerPaymentId !== verified.id)
          throw new ConflictException(
            "La intención ya fue pagada con otra operación",
          );
        return {
          id: payment.id,
          companyId: snapshot.companyId,
          alreadyProcessed: true,
        };
      }
      if (payment.status !== "PENDING")
        throw new ConflictException("La intención de cobro no está pendiente");
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "SUCCEEDED",
          providerPaymentId: verified.id,
          paidAt: verified.paidAt,
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException("El cobro ya fue procesado");
      const sub = payment.subscription;
      const now = new Date();
      const start =
        sub.status === "ACTIVE" &&
        sub.planId === snapshot.planId &&
        sub.endDate > now
          ? sub.endDate
          : now;
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          planId: snapshot.planId,
          billingCycle: snapshot.billingCycle,
          provider: "MERCADOPAGO",
          status: "ACTIVE",
          startDate:
            sub.status === "ACTIVE" && sub.planId === snapshot.planId
              ? sub.startDate
              : now,
          endDate: subscriptionEndDate(start, snapshot.billingCycle),
        },
      });
      if (sub.company.status !== "SUSPENDED")
        await tx.company.update({
          where: { id: snapshot.companyId },
          data: { status: "ACTIVE" },
        });
      await tx.platformAuditLog.create({
        data: {
          action: "UPDATE",
          entity: "Payment",
          entityId: payment.id,
          changes: {
            source: "MERCADOPAGO",
            providerPaymentId: verified.id,
            companyId: snapshot.companyId,
            planId: snapshot.planId,
          },
        },
      });
      return {
        id: payment.id,
        companyId: snapshot.companyId,
        alreadyProcessed: false,
      };
    });
    await this.invalidate(result.companyId);
    if (!result.alreadyProcessed) await this.announce(result.id);
    return result;
  }

  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await serializableTransaction(this.prisma, work);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "La operación del proveedor ya está registrada",
        );
      throw error;
    }
  }

  private async invalidate(companyId: string): Promise<void> {
    try {
      await Promise.all([
        this.capabilities.invalidate(companyId),
        this.cache.del(`company:status:${companyId}`),
      ]);
    } catch (error) {
      this.logger.error(
        `No se pudo invalidar la caché del pago confirmado: ${String(error)}`,
      );
    }
  }

  private async announce(id: string): Promise<void> {
    if (!this.notifications) return;
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id },
        select: {
          amount: true,
          currency: true,
          subscription: {
            select: {
              companyId: true,
              company: {
                select: {
                  name: true,
                  memberships: {
                    where: {
                      role: "COMPANY_ADMIN",
                      isActive: true,
                      user: { isActive: true },
                    },
                    select: { user: { select: { id: true, email: true } } },
                  },
                },
              },
            },
          },
        },
      });
      if (!payment) return;
      const tasks: Promise<unknown>[] = [];
      for (const membership of payment.subscription.company.memberships) {
        tasks.push(
          this.notifications.create({
            userId: membership.user.id,
            companyId: payment.subscription.companyId,
            type: "PAYMENT_RECEIVED",
            title: "Pago confirmado",
            message: `Se confirmó el cobro de ${payment.currency} ${payment.amount.toFixed(2)}.`,
            actionUrl: "/subscription",
            data: { paymentId: id },
          }),
        );
        if (this.email)
          tasks.push(
            this.email.sendEmail({
              to: membership.user.email,
              subject: "Pago confirmado",
              template: EmailTemplate.PAYMENT_RECEIVED,
              data: {
                companyName: payment.subscription.company.name,
                amount: payment.amount.toString(),
              },
            }),
          );
      }
      tasks.push(
        this.notifications.notifySuperAdmins({
          title: "Cobro de suscripción confirmado",
          type: "PAYMENT_RECEIVED",
          message: `${payment.subscription.company.name}: ${payment.currency} ${payment.amount.toFixed(2)}`,
          companyId: payment.subscription.companyId,
          actionUrl: "/platform/finanzas",
          data: { paymentId: id },
        }),
      );
      const results = await Promise.allSettled(tasks);
      if (results.some((result) => result.status === "rejected"))
        this.logger.warn(
          `El pago ${id} se confirmó, pero no se entregaron todos sus avisos`,
        );
    } catch (error) {
      this.logger.warn(
        `El pago ${id} se confirmó sin completar sus avisos: ${String(error)}`,
      );
    }
  }
}
