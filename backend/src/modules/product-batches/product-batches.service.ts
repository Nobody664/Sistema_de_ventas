import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { CreateProductBatchDto, UpdateProductBatchDto, ReserveBatchDto, QueryProductBatchDto } from './dto/product-batch.dto';

type PrismaTx = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$use' | '$extends'>;

@Injectable()
export class ProductBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateProductBatchDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, companyId },
    });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, companyId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    return this.prisma.productBatch.create({
      data: {
        companyId,
        productId: dto.productId,
        branchId: dto.branchId,
        batchNumber: dto.batchNumber,
        quantityReceived: dto.quantityReceived,
        quantityAvailable: dto.quantityAvailable,
        purchasePrice: dto.purchasePrice,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
      },
    });
  }

  async findAll(companyId: string, query: QueryProductBatchDto) {
    const where: Record<string, unknown> = { companyId };
    if (query.productId) where.productId = query.productId;
    if (query.branchId) where.branchId = query.branchId;

    return this.prisma.productBatch.findMany({
      where,
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { expirationDate: 'asc' },
    });
  }

  async findById(companyId: string, id: string) {
    const batch = await this.prisma.productBatch.findFirst({
      where: { id, companyId },
      include: { product: { select: { name: true, sku: true } }, branch: { select: { name: true } } },
    });
    if (!batch) throw new NotFoundException('Product batch not found');
    return batch;
  }

  async update(companyId: string, id: string, dto: UpdateProductBatchDto) {
    const batch = await this.prisma.productBatch.findFirst({ where: { id, companyId } });
    if (!batch) throw new NotFoundException('Product batch not found');

    return this.prisma.productBatch.update({
      where: { id },
      data: {
        ...(dto.quantityAvailable !== undefined ? { quantityAvailable: dto.quantityAvailable } : {}),
        ...(dto.purchasePrice !== undefined ? { purchasePrice: dto.purchasePrice } : {}),
        ...(dto.expirationDate !== undefined ? { expirationDate: new Date(dto.expirationDate) } : {}),
      },
    });
  }

  async remove(companyId: string, id: string) {
    const batch = await this.prisma.productBatch.findFirst({ where: { id, companyId } });
    if (!batch) throw new NotFoundException('Product batch not found');
    if (batch.quantityAvailable > 0) {
      throw new BadRequestException('Cannot delete a batch with available quantity');
    }

    await this.prisma.productBatch.delete({ where: { id } });
    return { deleted: true };
  }

  async findExpiring(companyId: string, days = 7) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);

    return this.prisma.productBatch.findMany({
      where: {
        companyId,
        expirationDate: { not: null, lte: threshold },
        quantityAvailable: { gt: 0 },
      },
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { expirationDate: 'asc' },
    });
  }

  async findEarliestBatch(productId: string, quantity: number, tx?: PrismaTx) {
    const client = tx ?? this.prisma;
    const batch = await client.productBatch.findFirst({
      where: {
        productId,
        quantityAvailable: { gte: quantity },
        expirationDate: { not: null },
      },
      orderBy: { expirationDate: 'asc' },
    });

    if (batch) return batch;

    return client.productBatch.findFirst({
      where: {
        productId,
        quantityAvailable: { gte: quantity },
        expirationDate: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reserveFromBatch(
    companyId: string,
    productId: string,
    quantity: number,
    tx: PrismaTx,
  ) {
    let remaining = quantity;

    const batches = await tx.productBatch.findMany({
      where: {
        companyId,
        productId,
        quantityAvailable: { gt: 0 },
        expirationDate: { not: null },
      },
      orderBy: { expirationDate: 'asc' },
    });

    const noExpiryBatches = await tx.productBatch.findMany({
      where: {
        companyId,
        productId,
        quantityAvailable: { gt: 0 },
        expirationDate: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    const allBatches = [...batches, ...noExpiryBatches];

    for (const batch of allBatches) {
      if (remaining <= 0) break;

      const deduct = Math.min(batch.quantityAvailable, remaining);
      await tx.productBatch.update({
        where: { id: batch.id },
        data: { quantityAvailable: { decrement: deduct } },
      });
      remaining -= deduct;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Insufficient batch stock for product ${productId}. Needed ${quantity}, but only ${quantity - remaining} available across batches.`,
      );
    }
  }

  async reserveBatch(
    companyId: string,
    id: string,
    dto: ReserveBatchDto,
  ) {
    const batch = await this.prisma.productBatch.findFirst({ where: { id, companyId } });
    if (!batch) throw new NotFoundException('Product batch not found');
    if (batch.quantityAvailable < dto.quantity) {
      throw new BadRequestException(`Batch ${batch.batchNumber} only has ${batch.quantityAvailable} units available`);
    }

    return this.prisma.productBatch.update({
      where: { id },
      data: { quantityAvailable: { decrement: dto.quantity } },
    });
  }
}
