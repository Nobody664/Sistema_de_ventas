import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { AuditService } from '@/common/services/audit.service';
import { KardexService } from '@/modules/kardex/kardex.service';
import { LowStockService } from '@/modules/low-stock/low-stock.service';
import { CreateInventoryAdjustmentDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly kardexService: KardexService,
    private readonly lowStockService: LowStockService,
  ) {}

  async findLowStock(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId, isActive: true },
      orderBy: { stockQuantity: 'asc' },
      take: 10000,
    });

    return products
      .filter((product) => product.stockQuantity.lte(product.minStock))
      .slice(0, 50);
  }

  findMovements(companyId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { companyId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async adjustStock(companyId: string, input: CreateInventoryAdjustmentDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, companyId },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    const quantity = new Prisma.Decimal(input.quantity);

    if (quantity.isZero()) {
      throw new BadRequestException('La cantidad debe ser distinta de cero.');
    }

    if (input.type !== 'ADJUSTMENT' && quantity.lt(0)) {
      throw new BadRequestException('La cantidad debe ser positiva para este tipo de movimiento.');
    }

    let delta: Prisma.Decimal;
    if (input.type === 'IN') {
      delta = quantity;
    } else if (input.type === 'OUT' || input.type === 'LOSS') {
      delta = quantity.neg();
    } else {
      delta = quantity;
    }

    const newStock = product.stockQuantity.plus(delta);
    if (newStock.lt(0)) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${Number(product.stockQuantity)}, ajuste: ${delta.toString()}.`,
      );
    }

    const unitCost = new Prisma.Decimal(input.unitCost ?? Number(product.costPrice ?? 0));

    const result = await this.prisma.$transaction(async (tx) => {
      const productUpdate = await tx.product.updateMany({
        where: { id: input.productId, companyId },
        data: { stockQuantity: { increment: delta } },
      });
      if (productUpdate.count === 0) {
        throw new NotFoundException('Product not found.');
      }

      const updatedProduct = await tx.product.findUnique({
        where: { id: input.productId },
      });
      if (!updatedProduct) {
        throw new NotFoundException('Product not found.');
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          companyId,
          productId: input.productId,
          presentationId: input.presentationId,
          type: input.type,
          quantity: delta,
          unitCost: input.type === 'IN' ? unitCost : undefined,
          totalCost: input.type === 'IN' ? unitCost.mul(delta) : undefined,
          reason: input.reason ?? 'Manual adjustment',
        },
      });

      if (delta.gt(0)) {
        await this.kardexService.recordInMovement(
          companyId,
          input.productId,
          delta,
          unitCost,
          movement.id,
          tx,
        );
      } else {
        await this.kardexService.recordOutMovement(
          companyId,
          input.productId,
          delta.abs(),
          movement.id,
          tx,
        );
      }

      return { updatedProduct, movement };
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: 'InventoryMovement',
      entityId: result.movement.id,
      changes: {
        productId: input.productId,
        productName: product.name,
        type: input.type,
        quantity: input.quantity,
        reason: result.movement.reason,
        stockBefore: Number(product.stockQuantity),
        stockAfter: Number(result.updatedProduct.stockQuantity),
      },
    });

    if (delta.lt(0)) {
      await this.lowStockService.notifyIfLowStock({
        companyId,
        productId: product.id,
        productName: product.name,
        currentStock: result.updatedProduct.stockQuantity,
        minStock: product.minStock,
        baseUnit: product.baseUnit,
        previousStock: product.stockQuantity,
      });
    }

    return result;
  }
}
