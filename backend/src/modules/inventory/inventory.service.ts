import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { AuditService } from '@/common/services/audit.service';
import { CreateInventoryAdjustmentDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findLowStock(companyId: string) {
    return this.prisma.product.findMany({
      where: {
        companyId,
        stockQuantity: {
          lte: 10,
        },
      },
      orderBy: { stockQuantity: 'asc' },
      take: 20,
    });
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

    if (product.stockQuantity + input.quantity < 0) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${product.stockQuantity}, ajuste: ${input.quantity}.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const productUpdate = await tx.product.updateMany({
        where: { id: input.productId, companyId },
        data: {
          stockQuantity: {
            increment: input.quantity,
          },
        },
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
          type: 'ADJUSTMENT',
          quantity: input.quantity,
          reason: input.reason ?? 'Manual adjustment',
        },
      });

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
        type: 'ADJUSTMENT',
        quantity: input.quantity,
        reason: result.movement.reason,
        stockBefore: product.stockQuantity,
        stockAfter: result.updatedProduct.stockQuantity,
      },
    });

    return result;
  }
}
