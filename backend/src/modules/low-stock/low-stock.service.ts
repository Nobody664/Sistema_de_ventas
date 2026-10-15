import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { NotificationsService, NotificationType } from '@/modules/notifications/notifications.service';

const UNIT_LABELS: Record<string, string> = {
  UNIT: 'unidades',
  KG: 'kg',
  LT: 'litros',
  MT: 'metros',
};

const LOW_STOCK_RECIPIENT_ROLES = ['COMPANY_ADMIN', 'MANAGER'] as const;

export interface LowStockCheckInput {
  companyId: string;
  productId: string;
  productName?: string | null;
  currentStock: Prisma.Decimal | number | null | undefined;
  minStock: Prisma.Decimal | number | null | undefined;
  baseUnit?: string | null;
  previousStock?: Prisma.Decimal | number | null;
  previousMinStock?: Prisma.Decimal | number | null;
  force?: boolean;
}

@Injectable()
export class LowStockService {
  private readonly logger = new Logger(LowStockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async notifyIfLowStock(input: LowStockCheckInput): Promise<boolean> {
    const currentStock = this.toNumber(input.currentStock);
    const minStock = this.toNumber(input.minStock);

    if (currentStock === null || minStock === null) {
      return false;
    }

    if (currentStock > minStock) {
      return false;
    }

    if (!input.force) {
      const previousStock = this.toNumber(input.previousStock);
      const previousMinStock = this.toNumber(input.previousMinStock) ?? minStock;

      if (previousStock !== null && previousStock <= previousMinStock) {
        return false;
      }
    }

    return this.dispatch(input, currentStock, minStock);
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async scanLowStock(): Promise<number> {
    try {
      const products = await this.prisma.product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          stockQuantity: { lte: this.prisma.product.fields.minStock },
        },
        select: {
          id: true,
          companyId: true,
          name: true,
          stockQuantity: true,
          minStock: true,
          baseUnit: true,
        },
      });

      let notified = 0;
      for (const product of products) {
        const sent = await this.notifyIfLowStock({
          companyId: product.companyId,
          productId: product.id,
          productName: product.name,
          currentStock: product.stockQuantity,
          minStock: product.minStock,
          baseUnit: product.baseUnit,
          force: true,
        });
        if (sent) {
          notified++;
        }
      }

      if (notified > 0) {
        this.logger.log(`Alertas de stock bajo enviadas: ${notified}`);
      }

      return notified;
    } catch (error) {
      this.logger.error('Error al escanear productos con stock bajo', error as Error);
      return 0;
    }
  }

  private async dispatch(input: LowStockCheckInput, currentStock: number, minStock: number): Promise<boolean> {
    const recipients = await this.getRecipients(input.companyId);
    if (recipients.length === 0) {
      return false;
    }

    const pending = await this.getPendingRecipients(input.companyId, input.productId, recipients);
    const targets = recipients.filter((userId) => !pending.has(userId));
    if (targets.length === 0) {
      return false;
    }

    const title = 'Stock bajo';
    const message = this.buildMessage(input.productName, currentStock, minStock, input.baseUnit);

    for (const userId of targets) {
      await this.notificationsService.create({
        userId,
        companyId: input.companyId,
        type: NotificationType.LOW_STOCK,
        title,
        message,
        data: {
          productId: input.productId,
          stockQuantity: currentStock,
          minStock,
        },
      });
    }

    return true;
  }

  private async getRecipients(companyId: string): Promise<string[]> {
    const members = await this.prisma.membership.findMany({
      where: {
        companyId,
        isActive: true,
        role: { in: [...LOW_STOCK_RECIPIENT_ROLES] },
      },
      select: { userId: true },
    });

    return [...new Set(members.map((member) => member.userId))];
  }

  private async getPendingRecipients(
    companyId: string,
    productId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    const pending = await this.prisma.notification.findMany({
      where: {
        companyId,
        type: 'LOW_STOCK',
        isRead: false,
        userId: { in: userIds },
        data: { path: ['productId'], equals: productId },
      },
      select: { userId: true },
    });

    return new Set(pending.map((notification) => notification.userId));
  }

  private buildMessage(
    productName: string | null | undefined,
    currentStock: number,
    minStock: number,
    baseUnit?: string | null,
  ): string {
    const name = productName?.trim() || 'Producto';
    const unit = UNIT_LABELS[(baseUnit ?? '').trim().toUpperCase()] ?? 'unidades';

    return (
      `El producto "${name}" tiene stock bajo: ` +
      `${this.format(currentStock)} ${unit} disponible(s) (mínimo ${this.format(minStock)} ${unit}).`
    );
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private format(value: number): string {
    if (!Number.isFinite(value)) {
      return '0';
    }
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(2).replace(/\.?0+$/, '');
  }
}
