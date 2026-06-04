import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/database/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationChannel } from '@/modules/notifications/notifications.service';

interface ProfileField {
  key: string;
  label: string;
  weight: number;
  validate: (value: string | null) => boolean;
}

const PROFILE_FIELDS: ProfileField[] = [
  { key: 'taxId',     label: 'RUC',           weight: 30, validate: (v) => !!v && /^\d{11}$/.test(v) },
  { key: 'legalName', label: 'Razón Social',  weight: 25, validate: (v) => !!v && v.length >= 3 },
  { key: 'address',   label: 'Dirección',     weight: 20, validate: (v) => !!v && v.length >= 10 },
  { key: 'phone',     label: 'Teléfono',      weight: 15, validate: (v) => !!v },
  { key: 'email',     label: 'Email',         weight: 10, validate: (v) => !!v && /@/.test(v) },
];

const FIELD_MESSAGES: Record<string, { title: string; message: string }> = {
  taxId: {
    title: 'Completa tu RUC',
    message: 'Aún falta conocerte un poco más. Completa tu RUC para que tus clientes tengan más confianza al adquirir tus productos.',
  },
  legalName: {
    title: 'Completa tu Razón Social',
    message: 'Completa tu Razón Social para que tus facturas y boletas tengan validez legal.',
  },
  address: {
    title: 'Completa tu dirección',
    message: 'Completa tu dirección así tus clientes podrán encontrarte más rápido.',
  },
  phone: {
    title: 'Agrega un teléfono',
    message: 'Agrega un número de contacto para que tus clientes puedan comunicarse contigo.',
  },
  email: {
    title: 'Verifica tu email',
    message: 'Confirma tu correo electrónico para recibir notificaciones importantes de tu negocio.',
  },
};

@Injectable()
export class CompanyProfileService {
  private readonly logger = new Logger(CompanyProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getProfileCompleteness(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        taxId: true,
        legalName: true,
        address: true,
        phone: true,
        email: true,
      },
    });

    if (!company) {
      return { score: 0, totalFields: PROFILE_FIELDS.length, completedFields: 0, missingFields: PROFILE_FIELDS.map(f => f.label) };
    }

    let score = 0;
    let completedFields = 0;
    const missingFields: string[] = [];

    for (const field of PROFILE_FIELDS) {
      const value = company[field.key as keyof typeof company] as string | null;
      if (field.validate(value)) {
        score += field.weight;
        completedFields++;
      } else {
        missingFields.push(field.label);
      }
    }

    return {
      score,
      totalFields: PROFILE_FIELDS.length,
      completedFields,
      missingFields,
    };
  }

  async getMissingFields(companyId: string): Promise<ProfileField[]> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        taxId: true,
        legalName: true,
        address: true,
        phone: true,
        email: true,
      },
    });

    if (!company) return PROFILE_FIELDS;

    return PROFILE_FIELDS.filter((field) => {
      const value = company[field.key as keyof typeof company] as string | null;
      return !field.validate(value);
    });
  }

  private async shouldNotify(companyId: string, field: string): Promise<boolean> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recent = await this.prisma.notification.findFirst({
      where: {
        companyId,
        type: 'SYSTEM' as any,
        data: { path: ['field'], equals: field } as any,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    return !recent;
  }

  async sendCompletionSuggestions(companyId: string, userId: string): Promise<number> {
    const missing = await this.getMissingFields(companyId);
    let sent = 0;

    for (const field of missing) {
      const canNotify = await this.shouldNotify(companyId, field.key);
      if (!canNotify) continue;

      const msg = FIELD_MESSAGES[field.key] ?? {
        title: 'Completa tu perfil',
        message: 'Completa la información de tu empresa para ofrecer una mejor experiencia a tus clientes.',
      };

      await this.notificationsService.create({
        userId,
        companyId,
        type: 'SYSTEM',
        channel: NotificationChannel.IN_APP,
        title: msg.title,
        message: msg.message,
        data: { field: field.key, action: '/settings/company' },
      });

      sent++;
    }

    return sent;
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkCompanyProfiles() {
    this.logger.log('Checking company profiles...');

    const companies = await this.prisma.company.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] as any } },
      include: {
        memberships: {
          where: { role: 'COMPANY_ADMIN' as any },
          include: { user: true },
          take: 1,
        },
      },
    });

    let totalSent = 0;
    for (const company of companies) {
      const admin = company.memberships[0]?.user;
      if (!admin) continue;

      const completeness = await this.getProfileCompleteness(company.id);
      if (completeness.score >= 100) continue;

      const sent = await this.sendCompletionSuggestions(company.id, admin.id);
      totalSent += sent;
    }

    this.logger.log(`Profile suggestions sent: ${totalSent}`);
    return totalSent;
  }
}
