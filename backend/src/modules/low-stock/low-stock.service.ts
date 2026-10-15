import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { NotificationsService, NotificationType } from '@/modules/notifications/notifications.service';

const UNIT_LABELS: Record<string, string> = {
  UNIT: 'unidades',
  KG: 'kg',
  LT: 'litros',
  MT: 'metros',
};

export interface LowStockCheckInput {
  companyId: string;
  productId: string;
  productName: string;
  currentStock: Prisma.Decimal | number;
  minStock: Prisma.Decimal | number;
  baseUnit?: string | null;
  previousStock?: Prisma.Decimal | number | null;
}

@Injectable()
export class LowStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async notifyIfLowStock(input: LowStockCheckInput): Promise<boolean> {
    const currentStock = this.toNumber(input.currentStock);
    const minStock = this.toNumber(input.minStock);

    if (currentStock > minStock) {
      return false;
    }

    if (input.previousStock != null && this.toNumber(input.previousStock) <= minStock) {
      return false;
    }

    const admins = await this.prisma.employee.findMany({
      where: { companyId: input.companyId, role: 'COMPANY_ADMIN', isActive: true },
      select: { userId: true },
    });

    if (admins.length === 0) {
      return false;
    }

    const unit = UNIT_LABELS[input.baseUnit ?? 'UNIT'] ?? 'unidades';
    const title = 'Stock bajo';
    const message =
      `El producto "${input.productName}" tiene stock bajo: ` +
      `${this.format(currentStock)} ${unit} disponible(s) (mínimo ${this.format(minStock)} ${unit}).`;

    for (const admin of admins) {
      if (!admin.userId) {
        continue;
      }

      await this.notificationsService.create({
        userId: admin.userId,
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

  private toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : Number(value);
  }

  private format(value: number): string {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(2).replace(/\.?0+$/, '');
  }
}
