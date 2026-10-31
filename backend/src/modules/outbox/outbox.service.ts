import {
  ConflictException,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import { OutboxEvent } from "@prisma/client";
import { isEmail } from "class-validator";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { EmailService, EmailTemplate } from "@/modules/email/email.service";
import { LowStockService } from "@/modules/low-stock/low-stock.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { CacheService } from "@/cache/cache.service";
import { WebhooksService } from "@/modules/integrations/webhooks.service";
import { DigestService } from "@/modules/notification-channels/digest.service";

const owners = {
  where: {
    role: "COMPANY_ADMIN" as const,
    isActive: true,
    user: { isActive: true },
  },
  select: { user: { select: { id: true, email: true } } },
};

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly lowStock: LowStockService,
    private readonly capabilities: PlanCapabilitiesService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    @Optional() private readonly webhooks?: WebhooksService,
    @Optional() private readonly digest?: DigestService,
  ) {}

  @Cron("*/10 * * * * *", { waitForCompletion: true })
  async processPending(): Promise<void> {
    const now = new Date();
    const lease = {
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: new Date(now.getTime() - 120000) } },
      ],
    };
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        processedAt: null,
        attempts: { lt: 10 },
        availableAt: { lte: now },
        ...lease,
      },
      orderBy: { createdAt: "asc" },
      take: 25,
    });
    for (const event of events) {
      const token = randomUUID();
      const claimNow = new Date();
      const claimLease = {
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: new Date(claimNow.getTime() - 120000) } },
        ],
      };
      const claimed = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          processedAt: null,
          attempts: { lt: 10 },
          availableAt: { lte: claimNow },
          ...claimLease,
        },
        data: {
          lockedAt: claimNow,
          leaseToken: token,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count !== 1) continue;
      const heartbeat = setInterval(() => {
        void this.prisma.outboxEvent
          .updateMany({
            where: { id: event.id, leaseToken: token, processedAt: null },
            data: { lockedAt: new Date() },
          })
          .catch(() =>
            this.logger.warn(`No se pudo renovar el lease ${event.id}`),
          );
      }, 30000);
      heartbeat.unref();
      try {
        await this.deliver(event);
        await this.prisma.outboxEvent.updateMany({
          where: { id: event.id, leaseToken: token, processedAt: null },
          data: {
            processedAt: new Date(),
            lockedAt: null,
            leaseToken: null,
            lastError: null,
          },
        });
      } catch {
        await this.prisma.outboxEvent.updateMany({
          where: { id: event.id, leaseToken: token, processedAt: null },
          data: {
            lockedAt: null,
            leaseToken: null,
            lastError: "DELIVERY_FAILED",
            availableAt: new Date(
              Date.now() + Math.min(3600000, 1000 * 2 ** event.attempts),
            ),
          },
        });
        this.logger.warn(
          `Efecto ${event.id} pendiente de reintento; intentos agotados requieren revisión`,
        );
      } finally {
        clearInterval(heartbeat);
      }
    }
  }

  async retry(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.outboxEvent.updateMany({
        where: {
          id,
          processedAt: null,
          OR: [
            { lockedAt: null },
            { lockedAt: { lt: new Date(Date.now() - 120000) } },
          ],
        },
        data: {
          attempts: 0,
          availableAt: new Date(),
          lockedAt: null,
          leaseToken: null,
          lastError: null,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "El efecto no existe, ya terminó o sigue en ejecución",
        );
      await tx.platformAuditLog.create({
        data: {
          actorId,
          action: "UPDATE",
          entity: "OutboxEvent",
          entityId: id,
          changes: { retry: true },
        },
      });
      return { retryScheduled: true };
    });
  }

  private async deliver(
    event: Pick<OutboxEvent, "id" | "kind" | "aggregateId">,
  ): Promise<void> {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(event.aggregateId))
      throw new Error("INVALID_EFFECT");
    if (event.kind === "DAILY_DIGEST") {
      if (!this.digest) throw new Error("DIGEST_UNAVAILABLE");
      await this.digest.deliver(event.aggregateId);
      return;
    }
    if (event.kind === "SALE_COMMITTED") {
      const sale = await this.prisma.sale.findUnique({
        where: { id: event.aggregateId },
        select: {
          companyId: true,
          saleNumber: true,
          totalAmount: true,
          channel: true,
          company: {
            select: {
              currency: true,
              memberships: {
                where: {
                  isActive: true,
                  role: { in: ["COMPANY_ADMIN", "MANAGER"] },
                  user: { isActive: true },
                },
                select: { userId: true },
              },
            },
          },
          items: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                  stockQuantity: true,
                  minStock: true,
                  baseUnit: true,
                },
              },
            },
          },
        },
      });
      if (!sale) throw new Error("MISSING_AGGREGATE");
      for (const member of sale.company?.memberships ?? []) {
        await this.notifications.create({
          dedupeKey: `${event.id}:sale:${member.userId}`,
          companyId: sale.companyId,
          userId: member.userId,
          type: "NEW_SALE",
          channel: "IN_APP",
          title: "Venta registrada",
          message: `Se registró la venta ${sale.saleNumber} por ${sale.totalAmount} ${sale.company?.currency ?? "PEN"}.`,
          actionUrl: `/sales/${event.aggregateId}`,
        });
      }
      for (const item of sale.channel === "DISTRIBUTOR" ? [] : sale.items)
        await this.lowStock.notifyIfLowStock({
          companyId: sale.companyId,
          productId: item.product.id,
          productName: item.product.name,
          currentStock: item.product.stockQuantity,
          minStock: item.product.minStock,
          baseUnit: item.product.baseUnit,
          force: true,
        });
      await this.webhooks?.enqueueSale(
        event.id,
        event.aggregateId,
        sale.companyId,
      );
      return;
    }
    if (event.kind === "PAYMENT_CONFIRMED") {
      const payment = await this.prisma.payment.findUnique({
        where: { id: event.aggregateId },
        select: {
          status: true,
          amount: true,
          currency: true,
          subscription: {
            select: {
              companyId: true,
              company: { select: { name: true, memberships: owners } },
            },
          },
        },
      });
      if (!payment || payment.status !== "SUCCEEDED")
        throw new Error("MISSING_AGGREGATE");
      await this.invalidate(payment.subscription.companyId);
      for (const member of payment.subscription.company.memberships) {
        await this.notifications.create({
          userId: member.user.id,
          companyId: payment.subscription.companyId,
          title: "Pago confirmado",
          message: `Se confirmó el cobro de ${payment.currency} ${payment.amount.toFixed(2)}.`,
          type: "PAYMENT_RECEIVED",
          actionUrl: "/subscription",
          dedupeKey: `${event.id}:company:${member.user.id}`,
        });
      }
      await this.notifications.notifySuperAdmins({
        title: "Cobro confirmado",
        message: `${payment.subscription.company.name}: ${payment.currency} ${payment.amount.toFixed(2)}`,
        type: "PAYMENT_RECEIVED",
        actionUrl: "/platform/finanzas",
        companyId: payment.subscription.companyId,
        dedupeKey: `${event.id}:platform`,
      });
      for (const member of payment.subscription.company.memberships)
        await this.mail(
          event.id,
          member.user.email,
          EmailTemplate.PAYMENT_RECEIVED,
          {
            companyName: payment.subscription.company.name,
            amount: payment.amount.toString(),
          },
        );
      return;
    }
    if (event.kind === "UPGRADE_REVIEWED") {
      const request = await this.prisma.planUpgradeRequest.findUnique({
        where: { id: event.aggregateId },
        select: {
          companyId: true,
          status: true,
          plan: { select: { name: true } },
          company: { select: { name: true, memberships: owners } },
        },
      });
      if (!request || request.status === "PENDING")
        throw new Error("MISSING_AGGREGATE");
      await this.invalidate(request.companyId);
      const approved = request.status === "APPROVED";
      for (const member of request.company.memberships) {
        await this.notifications.create({
          userId: member.user.id,
          companyId: request.companyId,
          title: approved ? "Plan aprobado" : "Solicitud rechazada",
          message: `Se revisó tu solicitud para ${request.plan.name}.`,
          type: approved ? "SUBSCRIPTION_APPROVED" : "SUBSCRIPTION_REJECTED",
          actionUrl: "/subscription",
          dedupeKey: `${event.id}:company:${member.user.id}`,
        });
      }
      await this.notifications.notifySuperAdmins({
        title: "Solicitud revisada",
        message: `${request.company.name}: ${request.status}`,
        companyId: request.companyId,
        actionUrl: "/platform/upgrade-requests",
        dedupeKey: `${event.id}:platform`,
      });
      for (const member of request.company.memberships)
        await this.mail(
          event.id,
          member.user.email,
          approved
            ? EmailTemplate.SUBSCRIPTION_APPROVED
            : EmailTemplate.SUBSCRIPTION_REJECTED,
          { companyName: request.company.name },
        );
      return;
    }
    if (
      event.kind === "CHECKOUT_SUBMITTED" ||
      event.kind === "CHECKOUT_REVIEWED"
    ) {
      const request = await this.prisma.checkoutRequest.findUnique({
        where: { id: event.aggregateId },
        select: {
          email: true,
          companyName: true,
          companyId: true,
          status: true,
          company: { select: { memberships: owners } },
          plan: { select: { name: true } },
        },
      });
      if (!request) throw new Error("MISSING_AGGREGATE");
      const reviewed = event.kind === "CHECKOUT_REVIEWED";
      if (reviewed && !["APPROVED", "REJECTED"].includes(request.status))
        throw new Error("MISSING_DECISION");
      if (request.companyId) await this.invalidate(request.companyId);
      if (reviewed && request.companyId) {
        for (const member of request.company?.memberships ?? []) {
          await this.notifications.create({
            userId: member.user.id,
            companyId: request.companyId,
            title:
              request.status === "APPROVED"
                ? "Plan aprobado"
                : "Solicitud rechazada",
            message: `Se revisó tu solicitud para ${request.plan.name}.`,
            type:
              request.status === "APPROVED"
                ? "SUBSCRIPTION_APPROVED"
                : "SUBSCRIPTION_REJECTED",
            actionUrl: "/subscription",
            dedupeKey: `${event.id}:company:${member.user.id}`,
          });
        }
      }
      await this.notifications.notifySuperAdmins({
        title: "Solicitud de pago actualizada",
        message: `${request.companyName ?? "Empresa"}: ${request.status}`,
        type: reviewed
          ? request.status === "APPROVED"
            ? "SUBSCRIPTION_APPROVED"
            : "SUBSCRIPTION_REJECTED"
          : "CHECKOUT_REQUEST_PENDING",
        actionUrl: "/platform/upgrade-requests",
        dedupeKey: `${event.id}:platform`,
      });
      const recipients = request.email
        ? [request.email]
        : (request.company?.memberships.map((member) => member.user.email) ??
          []);
      if (recipients.length === 0) throw new Error("MISSING_RECIPIENT");
      for (const recipient of new Set(recipients))
        await this.mail(
          event.id,
          recipient,
          event.kind === "CHECKOUT_SUBMITTED"
            ? EmailTemplate.PAYMENT_PROOF_RECEIVED
            : request.status === "APPROVED"
              ? EmailTemplate.SUBSCRIPTION_APPROVED
              : EmailTemplate.SUBSCRIPTION_REJECTED,
          {
            companyName: request.companyName ?? "Empresa",
            planName: request.plan.name,
          },
        );
      return;
    }
    throw new Error("UNSUPPORTED_EFFECT");
  }

  private async invalidate(companyId: string): Promise<void> {
    await this.capabilities.invalidate(companyId);
    await this.cache.del(`company:status:${companyId}`);
  }
  private async mail(
    id: string,
    to: string,
    template: EmailTemplate,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!isEmail(to) || /[\r\n]/.test(to)) throw new Error("INVALID_RECIPIENT");
    if (!this.config.get<boolean>("SMTP_ENABLED"))
      throw new Error("MAIL_DISABLED");
    await this.email.sendEmailDirect({
      to,
      template,
      subject: "Actualización de tu cuenta",
      data,
      messageId: `<${id}.${Buffer.from(to).toString("hex")}@huanka-saas.local>`,
    });
  }
}
