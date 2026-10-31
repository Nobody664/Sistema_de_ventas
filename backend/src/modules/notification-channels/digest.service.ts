import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { isEmail } from "class-validator";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  companyDateKey,
  companyMidnight,
  companyTimeZone,
  shiftDateKey,
} from "@/common/helpers/company-timezone.helper";
import { EmailService, EmailTemplate } from "@/modules/email/email.service";
import { enqueueDomainEffect } from "@/modules/outbox/outbox-event.helper";
import { IntegrationOwnerService } from "@/modules/integrations/integration-owner.service";
import { ChannelPreferencesDto } from "./dto/notification-channels.dto";

export function digestDay(now: Date, timeZone: string): string | null {
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return hour >= 8 ? shiftDateKey(companyDateKey(now, timeZone), -1) : null;
}

@Injectable()
export class DigestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: IntegrationOwnerService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async preferences(user: AuthUser) {
    const { membershipId } = await this.owners.require(user);
    const membership = await this.prisma.membership.findUniqueOrThrow({
      where: { id: membershipId },
      select: { dailyDigestEnabled: true, locale: true },
    });
    return {
      ...membership,
      available: this.config.get<boolean>("SMTP_ENABLED") === true,
      hour: "08:00",
    };
  }

  async update(user: AuthUser, input: ChannelPreferencesDto) {
    const { membershipId } = await this.owners.require(user);
    if (
      input.dailyDigestEnabled !== undefined &&
      typeof input.dailyDigestEnabled !== "boolean"
    )
      throw new BadRequestException("Preferencia inválida");
    if (input.locale !== undefined && !["es", "en"].includes(input.locale))
      throw new BadRequestException("Idioma inválido");
    if (
      input.dailyDigestEnabled &&
      this.config.get<boolean>("SMTP_ENABLED") !== true
    )
      throw new ServiceUnavailableException(
        "El envío de correo aún no está habilitado en el servidor",
      );
    await this.prisma.membership.updateMany({
      where: { id: membershipId, isActive: true },
      data: input,
    });
    return this.preferences(user);
  }

  @Cron("0 */5 * * * *", { waitForCompletion: true })
  async schedule(): Promise<void> {
    if (this.config.get<boolean>("SMTP_ENABLED") !== true) return;
    let after: string | undefined;
    const now = new Date();
    while (true) {
      const memberships = await this.prisma.membership.findMany({
        where: {
          dailyDigestEnabled: true,
          isActive: true,
          role: "COMPANY_ADMIN",
          user: { isActive: true },
          company: { status: { in: ["ACTIVE", "TRIAL"] } },
          ...(after ? { id: { gt: after } } : {}),
        },
        include: {
          company: {
            select: { id: true, name: true, currency: true, timezone: true },
          },
        },
        orderBy: { id: "asc" },
        take: 100,
      });
      for (const membership of memberships) {
        const zone = companyTimeZone(membership.company.timezone);
        const dateKey = digestDay(now, zone);
        if (!dateKey) continue;
        if (
          await this.prisma.digestDelivery.findUnique({
            where: {
              membershipId_dateKey: { membershipId: membership.id, dateKey },
            },
            select: { id: true },
          })
        )
          continue;
        const summary = await this.prisma.sale.aggregate({
          where: {
            companyId: membership.companyId,
            status: "COMPLETED",
            createdAt: {
              gte: companyMidnight(dateKey, zone),
              lt: companyMidnight(shiftDateKey(dateKey, 1), zone),
            },
          },
          _count: { id: true },
          _sum: { totalAmount: true },
        });
        const total = summary._sum.totalAmount?.toFixed(2) ?? "0.00";
        const message =
          membership.locale === "en"
            ? `${membership.company.name} | ${dateKey} | Completed sales: ${summary._count.id} | Revenue: ${total} ${membership.company.currency}.`
            : `${membership.company.name} | ${dateKey} | Ventas completadas: ${summary._count.id} | Ingresos: ${total} ${membership.company.currency}.`;
        await this.prisma.$transaction(async (tx) => {
          const delivery = await tx.digestDelivery.upsert({
            where: {
              membershipId_dateKey: { membershipId: membership.id, dateKey },
            },
            create: {
              membershipId: membership.id,
              dateKey,
              message,
              locale: membership.locale,
            },
            update: {},
          });
          await enqueueDomainEffect(tx, "DAILY_DIGEST", delivery.id);
        });
      }
      if (memberships.length < 100) break;
      after = memberships.at(-1)!.id;
    }
  }

  async deliver(id: string): Promise<void> {
    const delivery = await this.prisma.digestDelivery.findUniqueOrThrow({
      where: { id },
      include: {
        membership: {
          include: {
            user: { select: { email: true, isActive: true } },
            company: { select: { status: true } },
          },
        },
      },
    });
    if (delivery.sentAt) return;
    const member = delivery.membership;
    if (
      !member.dailyDigestEnabled ||
      !member.isActive ||
      member.role !== "COMPANY_ADMIN" ||
      !member.user.isActive ||
      !["ACTIVE", "TRIAL"].includes(member.company.status)
    )
      return;
    if (
      this.config.get<boolean>("SMTP_ENABLED") !== true ||
      !isEmail(member.user.email)
    )
      throw new ServiceUnavailableException(
        "El resumen no se pudo entregar por correo",
      );
    await this.email.sendEmailDirect({
      messageId: `<digest-${id}@notifications.ventas>`,
      to: member.user.email,
      subject:
        delivery.locale === "en"
          ? "Daily business summary"
          : "Resumen diario del negocio",
      template: EmailTemplate.DAILY_SUMMARY,
      data: { message: delivery.message },
    });
    await this.prisma.digestDelivery.update({
      where: { id },
      data: { sentAt: new Date() },
    });
  }
}
