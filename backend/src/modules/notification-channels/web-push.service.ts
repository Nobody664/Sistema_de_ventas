import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import webPush from "web-push";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { PrismaService } from "@/database/prisma/prisma.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { IntegrationOwnerService } from "@/modules/integrations/integration-owner.service";
import { IntegrationSecretsService } from "@/modules/integrations/integration-secrets.service";
import { PushSubscriptionDto } from "./dto/notification-channels.dto";

export function validPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.port &&
      [
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

@Injectable()
export class WebPushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: IntegrationOwnerService,
    private readonly secrets: IntegrationSecretsService,
    private readonly config: ConfigService,
  ) {}

  available(): boolean {
    try {
      if (!this.secrets.available()) return false;
      const details = this.details();
      webPush.generateRequestDetails(
        {
          endpoint: "https://fcm.googleapis.com/fcm/send/configuration-check",
          keys: { p256dh: "", auth: "" },
        },
        null,
        { vapidDetails: details },
      );
      return true;
    } catch {
      return false;
    }
  }

  private details() {
    return {
      subject: this.config.get<string>("VAPID_SUBJECT") ?? "",
      publicKey: this.config.get<string>("VAPID_PUBLIC_KEY") ?? "",
      privateKey: this.config.get<string>("VAPID_PRIVATE_KEY") ?? "",
    };
  }

  async status(user: AuthUser) {
    const { membershipId } = await this.owners.require(user);
    return {
      available: this.available(),
      publicKey: this.available() ? this.details().publicKey : null,
      subscriptions: await this.prisma.webPushSubscription.findMany({
        where: { membershipId },
        select: { id: true, endpointHash: true, createdAt: true },
        take: 10,
      }),
    };
  }

  async subscribe(user: AuthUser, input: PushSubscriptionDto) {
    const owner = await this.owners.require(user);
    if (!this.available())
      throw new ServiceUnavailableException(
        "Web Push requiere VAPID y cifrado configurados en el servidor",
      );
    if (!validPushEndpoint(input.endpoint))
      throw new BadRequestException("Proveedor Web Push no admitido");
    const endpointHash = createHash("sha256")
      .update(input.endpoint)
      .digest("hex");
    const encryptedSubscription = this.secrets.encrypt(JSON.stringify(input));
    return serializableTransaction(this.prisma, async (tx) => {
      const count = await tx.webPushSubscription.count({
        where: { membershipId: owner.membershipId, NOT: { endpointHash } },
      });
      if (count >= 10)
        throw new BadRequestException(
          "El usuario ya tiene diez navegadores registrados",
        );
      return tx.webPushSubscription.upsert({
        where: { endpointHash },
        create: {
          membershipId: owner.membershipId,
          endpointHash,
          encryptedSubscription,
        },
        update: {
          membershipId: owner.membershipId,
          encryptedSubscription,
          createdAt: new Date(),
        },
        select: { id: true },
      });
    });
  }

  async unsubscribe(user: AuthUser, id: string) {
    const { membershipId } = await this.owners.require(user);
    await this.prisma.webPushSubscription.deleteMany({
      where: { id, membershipId },
    });
    return { removed: true };
  }

  @Cron("*/20 * * * * *", { waitForCompletion: true })
  async process(): Promise<void> {
    if (!this.available()) return;
    const notices = await this.prisma.notification.findMany({
      where: {
        pushQueuedAt: null,
        scope: "COMPANY",
        channel: "IN_APP",
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    for (const notice of notices) {
      const subscriptions =
        notice.companyId && notice.userId
          ? await this.prisma.webPushSubscription.findMany({
              where: {
                createdAt: { lte: notice.createdAt },
                membership: {
                  companyId: notice.companyId,
                  userId: notice.userId,
                  isActive: true,
                  role: "COMPANY_ADMIN",
                  user: { isActive: true },
                },
              },
              select: { id: true },
            })
          : [];
      await this.prisma.$transaction(async (tx) => {
        for (const subscription of subscriptions)
          await tx.pushDelivery.upsert({
            where: {
              subscriptionId_notificationId: {
                subscriptionId: subscription.id,
                notificationId: notice.id,
              },
            },
            create: {
              subscriptionId: subscription.id,
              notificationId: notice.id,
            },
            update: {},
          });
        await tx.notification.update({
          where: { id: notice.id },
          data: { pushQueuedAt: new Date() },
        });
      });
    }
    const now = new Date();
    const lease = {
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: new Date(now.getTime() - 120000) } },
      ],
    };
    const deliveries = await this.prisma.pushDelivery.findMany({
      where: {
        finishedAt: null,
        attempts: { lt: 5 },
        availableAt: { lte: now },
        ...lease,
      },
      include: {
        notification: {
          select: {
            userId: true,
            companyId: true,
            isRead: true,
            createdAt: true,
          },
        },
        subscription: {
          include: {
            membership: {
              include: {
                company: { select: { status: true } },
                user: { select: { isActive: true } },
              },
            },
          },
        },
      },
      take: 20,
    });
    for (const delivery of deliveries) {
      const token = randomUUID();
      const claim = await this.prisma.pushDelivery.updateMany({
        where: {
          id: delivery.id,
          finishedAt: null,
          attempts: delivery.attempts,
          ...lease,
        },
        data: {
          lockedAt: new Date(),
          leaseToken: token,
          attempts: { increment: 1 },
        },
      });
      if (claim.count !== 1) continue;
      const where = { id: delivery.id, leaseToken: token, finishedAt: null };
      const member = delivery.subscription.membership;
      try {
        if (
          delivery.notification.isRead ||
          delivery.notification.createdAt.getTime() < Date.now() - 86400000 ||
          !member.isActive ||
          member.role !== "COMPANY_ADMIN" ||
          !member.user.isActive ||
          member.userId !== delivery.notification.userId ||
          member.companyId !== delivery.notification.companyId ||
          !["ACTIVE", "TRIAL"].includes(member.company.status)
        ) {
          await this.prisma.pushDelivery.updateMany({
            where,
            data: {
              finishedAt: new Date(),
              lockedAt: null,
              leaseToken: null,
              lastError: "DELIVERY_SKIPPED",
            },
          });
          continue;
        }
        const subscription = JSON.parse(
          this.secrets.decrypt(delivery.subscription.encryptedSubscription),
        ) as PushSubscriptionDto;
        if (!validPushEndpoint(subscription.endpoint))
          throw new Error("INVALID_ENDPOINT");
        const english = member.locale === "en";
        await webPush.sendNotification(
          subscription,
          JSON.stringify({
            title: english ? "New notification" : "Nueva notificación",
            body: english
              ? "Open the system to view your notifications."
              : "Abre el sistema para consultar tus notificaciones.",
            url: "/notifications",
            tag: delivery.notificationId,
          }),
          { vapidDetails: this.details(), TTL: 300, timeout: 10000 },
        );
        await this.prisma.pushDelivery.updateMany({
          where,
          data: {
            finishedAt: new Date(),
            lockedAt: null,
            leaseToken: null,
            lastError: null,
          },
        });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410)
          await this.prisma.webPushSubscription.deleteMany({
            where: { id: delivery.subscriptionId },
          });
        else
          await this.prisma.pushDelivery.updateMany({
            where,
            data: {
              lockedAt: null,
              leaseToken: null,
              availableAt: new Date(
                Date.now() + 60000 * 2 ** delivery.attempts,
              ),
              lastError: "DELIVERY_FAILED",
              ...(delivery.attempts >= 4 ? { finishedAt: new Date() } : {}),
            },
          });
      }
    }
  }
}
