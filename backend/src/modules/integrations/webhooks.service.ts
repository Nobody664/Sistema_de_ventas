import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { IntegrationOwnerService } from "./integration-owner.service";
import { IntegrationSecretsService } from "./integration-secrets.service";
import { WebhookTransportService } from "./webhook-transport.service";
import { CreateWebhookDto } from "./dto/webhook.dto";

const metadata = {
  id: true,
  name: true,
  url: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.WebhookEndpointSelect;

export function webhookSignature(
  secret: string,
  timestamp: string,
  payload: string,
): string {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: IntegrationOwnerService,
    private readonly secrets: IntegrationSecretsService,
    private readonly transport: WebhookTransportService,
    private readonly plans: PlanCapabilitiesService,
  ) {}

  private async assertPlan(companyId: string): Promise<void> {
    const plan = await this.plans.getCapabilities(companyId);
    if (!this.plans.hasFeature(plan, "webhooks.manage"))
      throw new ForbiddenException("Tu plan no incluye webhooks salientes");
  }

  async list(user: AuthUser) {
    const { companyId } = await this.owners.require(user);
    return {
      available:
        this.secrets.available() && this.transport.allowedHosts().length > 0,
      allowedHosts: this.transport.allowedHosts(),
      events: ["sale.created"],
      endpoints: await this.prisma.webhookEndpoint.findMany({
        where: { companyId },
        select: metadata,
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
    };
  }

  async create(user: AuthUser, input: CreateWebhookDto) {
    const owner = await this.owners.require(user);
    await this.assertPlan(owner.companyId);
    const url = this.transport.validate(input.url).href;
    const secret = randomBytes(32).toString("base64url");
    const encryptedSecret = this.secrets.encrypt(secret);
    const endpoint = await serializableTransaction(this.prisma, async (tx) => {
      if (
        (await tx.webhookEndpoint.count({
          where: { companyId: owner.companyId, isActive: true },
        })) >= 5
      )
        throw new ConflictException(
          "El negocio ya tiene cinco webhooks activos",
        );
      const created = await tx.webhookEndpoint.create({
        data: {
          companyId: owner.companyId,
          membershipId: owner.membershipId,
          name: input.name,
          url,
          encryptedSecret,
        },
        select: metadata,
      });
      await tx.auditLog.create({
        data: {
          companyId: owner.companyId,
          userId: owner.userId,
          action: "CREATE",
          entity: "WebhookEndpoint",
          entityId: created.id,
        },
      });
      return created;
    });
    return { ...endpoint, secret };
  }

  async disable(user: AuthUser, id: string) {
    const owner = await this.owners.require(user);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.webhookEndpoint.updateMany({
        where: { id, companyId: owner.companyId },
        data: { isActive: false },
      });
      if (!updated.count) throw new NotFoundException("Webhook no encontrado");
      await tx.auditLog.create({
        data: {
          companyId: owner.companyId,
          userId: owner.userId,
          action: "UPDATE",
          entity: "WebhookEndpoint",
          entityId: id,
          changes: { disabled: true },
        },
      });
      return { disabled: true };
    });
  }

  async history(user: AuthUser, id: string) {
    const { companyId } = await this.owners.require(user);
    if (
      !(await this.prisma.webhookEndpoint.findFirst({
        where: { id, companyId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Webhook no encontrado");
    return this.prisma.webhookDelivery.findMany({
      where: { endpointId: id },
      select: {
        id: true,
        eventId: true,
        attempts: true,
        deliveredAt: true,
        stoppedAt: true,
        availableAt: true,
        statusCode: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async enqueueSale(
    eventId: string,
    saleId: string,
    companyId: string,
  ): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { companyId, isActive: true },
      select: { id: true, createdAt: true },
    });
    if (!endpoints.length) return;
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, companyId },
      select: {
        id: true,
        saleNumber: true,
        status: true,
        channel: true,
        totalAmount: true,
        createdAt: true,
        company: { select: { currency: true } },
      },
    });
    if (!sale) throw new NotFoundException("Venta no encontrada");
    const payload: Prisma.InputJsonObject = {
      id: eventId,
      type: "sale.created",
      version: 1,
      companyId,
      occurredAt: sale.createdAt.toISOString(),
      data: {
        id: sale.id,
        saleNumber: sale.saleNumber,
        status: sale.status,
        channel: sale.channel,
        totalAmount: sale.totalAmount.toString(),
        currency: sale.company.currency,
      },
    };
    for (const endpoint of endpoints) {
      if (endpoint.createdAt > sale.createdAt) continue;
      await this.prisma.webhookDelivery.upsert({
        where: { endpointId_eventId: { endpointId: endpoint.id, eventId } },
        create: { endpointId: endpoint.id, eventId, payload },
        update: {},
      });
    }
  }

  @Cron("*/15 * * * * *", { waitForCompletion: true })
  async process(): Promise<void> {
    const now = new Date();
    const lease = {
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: new Date(now.getTime() - 120000) } },
      ],
    };
    const pending = await this.prisma.webhookDelivery.findMany({
      where: {
        deliveredAt: null,
        stoppedAt: null,
        attempts: { lt: 10 },
        availableAt: { lte: now },
        ...lease,
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: {
        endpoint: {
          include: {
            company: { select: { status: true } },
            membership: {
              select: {
                isActive: true,
                role: true,
                user: { select: { isActive: true } },
              },
            },
          },
        },
      },
    });
    for (const row of pending) {
      const token = randomUUID();
      const claimed = await this.prisma.webhookDelivery.updateMany({
        where: {
          id: row.id,
          deliveredAt: null,
          stoppedAt: null,
          attempts: row.attempts,
          ...lease,
        },
        data: {
          lockedAt: new Date(),
          leaseToken: token,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count !== 1) continue;
      const where = { id: row.id, leaseToken: token, deliveredAt: null };
      const endpoint = row.endpoint;
      let statusCode: number | null = null;
      try {
        if (
          !endpoint.isActive ||
          !endpoint.membership.isActive ||
          endpoint.membership.role !== "COMPANY_ADMIN" ||
          !endpoint.membership.user.isActive ||
          !["ACTIVE", "TRIAL"].includes(endpoint.company.status)
        ) {
          await this.prisma.webhookDelivery.updateMany({
            where,
            data: {
              stoppedAt: new Date(),
              lockedAt: null,
              leaseToken: null,
              lastError: "ENDPOINT_DISABLED",
            },
          });
          continue;
        }
        await this.assertPlan(endpoint.companyId);
        const body = JSON.stringify(row.payload);
        const timestamp = String(Math.floor(Date.now() / 1000));
        statusCode = await this.transport.send(endpoint.url, body, {
          "X-Ventas-Event": "sale.created",
          "X-Ventas-Delivery": row.id,
          "X-Ventas-Timestamp": timestamp,
          "X-Ventas-Signature": webhookSignature(
            this.secrets.decrypt(endpoint.encryptedSecret),
            timestamp,
            body,
          ),
        });
        if (statusCode < 200 || statusCode >= 300)
          throw new Error("HTTP_REJECTED");
        await this.prisma.webhookDelivery.updateMany({
          where,
          data: {
            deliveredAt: new Date(),
            lockedAt: null,
            leaseToken: null,
            statusCode,
            lastError: null,
          },
        });
      } catch {
        await this.prisma.webhookDelivery.updateMany({
          where,
          data: {
            lockedAt: null,
            leaseToken: null,
            statusCode,
            lastError: "DELIVERY_FAILED",
            availableAt: new Date(
              Date.now() + Math.min(3600000, 60000 * 2 ** row.attempts),
            ),
            ...(row.attempts >= 9 ? { stoppedAt: new Date() } : {}),
          },
        });
        this.logger.warn(
          `Webhook ${row.id} pendiente o detenido tras intento ${row.attempts + 1}`,
        );
      }
    }
  }
}
