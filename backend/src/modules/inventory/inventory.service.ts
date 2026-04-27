import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateInventoryAdjustmentDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: input.productId },
        data: {
          stockQuantity: {
            increment: input.quantity,
          },
        },
      });

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
  }
}
