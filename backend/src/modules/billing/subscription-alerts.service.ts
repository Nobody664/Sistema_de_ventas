import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";

@Injectable()
export class SubscriptionAlertsService {
  private readonly logger = new Logger(SubscriptionAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron("0 7 * * *", { timeZone: "America/Lima", waitForCompletion: true })
  async notifyLifecycle(): Promise<void> {
    const now = new Date();
    const [subscriptions, superAdmins] = await Promise.all([
      this.prisma.subscription.findMany({
        where: {
          status: { in: ["ACTIVE", "TRIALING", "PAST_DUE", "EXPIRED"] },
          endDate: {
            gte: new Date(now.getTime() - 2 * 86400000),
            lte: new Date(now.getTime() + 3 * 86400000),
          },
        },
        include: {
          plan: true,
          company: {
            include: {
              memberships: {
                where: { role: "COMPANY_ADMIN", user: { isActive: true } },
                select: { userId: true },
              },
            },
          },
        },
      }),
      this.prisma.user.findMany({
        where: { globalRole: "SUPER_ADMIN", isActive: true },
        select: { id: true },
      }),
    ]);
    for (const subscription of subscriptions) {
      const expired = subscription.endDate <= now;
      const key = `${subscription.id}:${subscription.endDate.toISOString()}:${expired ? "expired" : "expiring"}`;
      const recipients = new Map<string, "PLATFORM" | "COMPANY">();
      subscription.company.memberships.forEach((membership) =>
        recipients.set(membership.userId, "COMPANY"),
      );
      superAdmins.forEach((user) => recipients.set(user.id, "PLATFORM"));
      for (const [userId, scope] of recipients) {
        try {
          const existing = await this.prisma.notification.findFirst({
            where: {
              userId,
              data: { path: ["subscriptionAlertKey"], equals: key },
            },
            select: { id: true },
          });
          if (existing) continue;
          await this.notifications.create({
            userId,
            companyId: subscription.companyId,
            scope,
            type: "GENERAL",
            title: expired ? "Suscripción vencida" : "Suscripción por vencer",
            message: `${subscription.company.name}: el plan ${subscription.plan.name} ${expired ? "venció" : "vence"} el ${subscription.endDate.toLocaleDateString("es-PE", { timeZone: "America/Lima" })}.`,
            actionUrl:
              scope === "PLATFORM" ? "/platform/subscribers" : "/subscription",
            data: {
              subscriptionAlertKey: key,
              subscriptionId: subscription.id,
              companyId: subscription.companyId,
            },
          });
        } catch (error) {
          this.logger.warn(
            `No se pudo enviar la alerta de suscripción a ${userId}: ${String(error)}`,
          );
        }
      }
    }
  }
}
