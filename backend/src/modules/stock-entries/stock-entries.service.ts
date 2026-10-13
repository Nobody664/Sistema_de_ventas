import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, AuditAction } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { KardexService } from '@/modules/kardex/kardex.service';
import { AuditService } from '@/common/services/audit.service';
import { CreateStockEntryDto } from './dto/stock-entry.dto';

@Injectable()
export class StockEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kardexService: KardexService,
    private readonly auditService: AuditService,
  ) {}

  findAll(companyId: string) {
    return this.prisma.stockEntry.findMany({
      where: { companyId },
      include: {
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, baseUnit: true } },
            presentation: { select: { id: true, name: true, factor: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findById(companyId: string, id: string) {
    const entry = await this.prisma.stockEntry.findFirst({
      where: { id, companyId },
      include: {
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, baseUnit: true } },
            presentation: { select: { id: true, name: true, factor: true } },
          },
        },
      },
    });
    if (!entry) throw new NotFoundException('Stock entry not found.');
    return entry;
  }

  async create(companyId: string, input: CreateStockEntryDto) {
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: input.branchId, companyId },
      });
      if (!branch) throw new NotFoundException('Branch not found.');
    }

    const productIds = Array.from(new Set(input.items.map((item) => item.productId)));
    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      include: { presentations: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const resolvedItems = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found.`);
      }

      const presentation = item.presentationId
        ? product.presentations.find((entry) => entry.id === item.presentationId)
        : undefined;
      if (item.presentationId && !presentation) {
        throw new BadRequestException(`Presentation ${item.presentationId} not found.`);
      }

      const factor = presentation ? new Prisma.Decimal(presentation.factor) : new Prisma.Decimal(1);
      const quantity = new Prisma.Decimal(item.quantity);
      const baseQuantity = quantity.mul(factor);
      const unitCost = new Prisma.Decimal(item.unitCost);
      const totalCost = unitCost.mul(quantity);
      const baseUnitCost = baseQuantity.isZero() ? unitCost : totalCost.div(baseQuantity);

      return {
        productId: item.productId,
        productName: product.name,
        presentationId: presentation?.id,
        quantity,
        baseQuantity,
        unitCost,
        totalCost,
        baseUnitCost,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.stockEntry.create({
        data: {
          companyId,
          branchId: input.branchId,
          reference: input.reference,
          notes: input.notes,
          items: {
            create: resolvedItems.map((item) => ({
              productId: item.productId,
              presentationId: item.presentationId,
              quantity: item.quantity,
              baseQuantity: item.baseQuantity,
              unitCost: item.unitCost,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of resolvedItems) {
        const update = await tx.product.updateMany({
          where: { id: item.productId, companyId },
          data: {
            stockQuantity: { increment: item.baseQuantity },
            costPrice: item.baseUnitCost,
          },
        });
        if (update.count === 0) {
          throw new NotFoundException(`Product ${item.productId} not found.`);
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            companyId,
            productId: item.productId,
            presentationId: item.presentationId,
            type: 'IN',
            quantity: item.baseQuantity,
            unitCost: item.baseUnitCost,
            totalCost: item.totalCost,
            notes: `Stock entry ${entry.id}`,
          },
        });

        await this.kardexService.recordInMovement(
          companyId,
          item.productId,
          item.baseQuantity,
          item.baseUnitCost,
          movement.id,
          tx,
        );
      }

      await this.auditService.log({
        companyId,
        action: AuditAction.CREATE,
        entity: 'StockEntry',
        entityId: entry.id,
        changes: {
          reference: entry.reference,
          branchId: entry.branchId,
          items: resolvedItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            presentationId: item.presentationId,
            quantity: item.quantity.toString(),
            baseQuantity: item.baseQuantity.toString(),
            unitCost: item.unitCost.toString(),
          })),
        },
      });

      return this.findById(companyId, entry.id);
    });
  }
}
