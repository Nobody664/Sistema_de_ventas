import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CostingStrategy } from './strategies/costing.strategy';
import { FifoStrategy } from './strategies/fifo.strategy';
import { WeightedAverageStrategy } from './strategies/weighted-average.strategy';
import { QueryKardexDto } from './dto/kardex.dto';

type PrismaTx = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$use' | '$extends'>;

@Injectable()
export class KardexService {
  private strategies: Map<string, CostingStrategy>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fifoStrategy: FifoStrategy,
    private readonly weightedAverageStrategy: WeightedAverageStrategy,
  ) {
    this.strategies = new Map<string, CostingStrategy>([
      ['FIFO', this.fifoStrategy],
      ['WEIGHTED_AVERAGE', this.weightedAverageStrategy],
    ]);
  }

  private async getStrategy(companyId: string): Promise<CostingStrategy> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { inventoryCostMethod: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const strategy = this.strategies.get(company.inventoryCostMethod);
    if (!strategy) throw new Error(`Unknown costing strategy: ${company.inventoryCostMethod}`);
    return strategy;
  }

  async recordInMovement(
    companyId: string,
    productId: string,
    quantity: number,
    unitCost: Decimal,
    movementId: string,
    tx: PrismaTx,
  ): Promise<void> {
    const lastEntry = await tx.inventoryKardex.findFirst({
      where: { productId, companyId },
      orderBy: { movementDate: 'desc' },
    });

    const prevBalanceQty = lastEntry?.balanceQty ?? 0;
    const prevBalanceTotalCost = lastEntry?.balanceTotalCost ?? new Decimal(0);
    const totalCostIn = unitCost.mul(quantity);
    const newBalanceQty = prevBalanceQty + quantity;
    const newBalanceTotalCost = prevBalanceTotalCost.plus(totalCostIn);
    const newBalanceUnitCost = newBalanceQty > 0 ? newBalanceTotalCost.div(newBalanceQty) : new Decimal(0);

    await tx.inventoryKardex.create({
      data: {
        companyId,
        productId,
        movementId,
        movementDate: new Date(),
        movementType: 'IN',
        qtyIn: quantity,
        unitCostIn: unitCost,
        totalCostIn,
        qtyOut: 0,
        balanceQty: newBalanceQty,
        balanceUnitCost: newBalanceUnitCost,
        balanceTotalCost: newBalanceTotalCost,
      },
    });
  }

  async recordOutMovement(
    companyId: string,
    productId: string,
    quantity: number,
    movementId: string,
    tx: PrismaTx,
  ): Promise<{ unitCost: Decimal; totalCost: Decimal }> {
    const strategy = await this.getStrategy(companyId);
    const { unitCost, totalCost } = await strategy.calculateOutCost(
      productId,
      quantity,
      companyId,
      tx,
    );

    const lastEntry = await tx.inventoryKardex.findFirst({
      where: { productId, companyId },
      orderBy: { movementDate: 'desc' },
    });

    const prevBalanceQty = lastEntry?.balanceQty ?? 0;
    const prevBalanceTotalCost = lastEntry?.balanceTotalCost ?? new Decimal(0);
    const newBalanceQty = prevBalanceQty - quantity;
    const newBalanceTotalCost = prevBalanceTotalCost.minus(totalCost);
    const newBalanceUnitCost = newBalanceQty > 0 ? newBalanceTotalCost.div(newBalanceQty) : new Decimal(0);

    await tx.inventoryKardex.create({
      data: {
        companyId,
        productId,
        movementId,
        movementDate: new Date(),
        movementType: 'OUT',
        qtyOut: quantity,
        unitCostOut: unitCost,
        totalCostOut: totalCost,
        balanceQty: newBalanceQty,
        balanceUnitCost: newBalanceUnitCost,
        balanceTotalCost: newBalanceTotalCost,
      },
    });

    return { unitCost, totalCost };
  }

  async query(companyId: string, filters: QueryKardexDto) {
    const where: Record<string, unknown> = { companyId };

    if (filters.productId) where.productId = filters.productId;
    if (filters.movementType) where.movementType = filters.movementType;
    if (filters.startDate || filters.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
      if (filters.endDate) dateFilter.lte = new Date(filters.endDate);
      where.movementDate = dateFilter;
    }

    return this.prisma.inventoryKardex.findMany({
      where,
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { movementDate: 'desc' },
    });
  }

  async getSummary(companyId: string) {
    const result = await this.prisma.inventoryKardex.groupBy({
      by: ['productId'],
      where: { companyId },
      _max: {
        balanceQty: true,
        balanceTotalCost: true,
        balanceUnitCost: true,
      },
    });

    const products = await this.prisma.product.findMany({
      where: { companyId },
      select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const entries = result
      .filter((r) => r._max.balanceQty !== null && r._max.balanceQty > 0)
      .map((r) => {
        const product = productMap.get(r.productId);
        return {
          productId: r.productId,
          productName: product?.name ?? 'Unknown',
          productSku: product?.sku ?? '',
          balanceQty: r._max.balanceQty ?? 0,
          balanceUnitCost: r._max.balanceUnitCost ?? new Decimal(0),
          balanceTotalCost: r._max.balanceTotalCost ?? new Decimal(0),
        };
      });

    const totalValue = entries.reduce(
      (sum, e) => sum.plus(e.balanceTotalCost),
      new Decimal(0),
    );

    return { entries, totalValue };
  }

  async getProfitability(
    companyId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const kardexEntries = await this.prisma.inventoryKardex.findMany({
      where: {
        companyId,
        movementType: 'OUT',
        ...(startDate || endDate ? { movementDate: dateFilter } : {}),
      },
    });

    const productIds = [...new Set(kardexEntries.map((k) => k.productId))];

    const saleItems = await this.prisma.saleItem.findMany({
      where: {
        productId: { in: productIds },
        sale: { companyId },
      },
      include: { sale: { select: { createdAt: true } } },
    });

    const revenueByProduct = new Map<string, Decimal>();
    for (const item of saleItems) {
      if (startDate && item.sale.createdAt < new Date(startDate)) continue;
      if (endDate && item.sale.createdAt > new Date(endDate)) continue;
      const current = revenueByProduct.get(item.productId) ?? new Decimal(0);
      revenueByProduct.set(item.productId, current.plus(item.totalPrice));
    }

    const costByProduct = new Map<string, Decimal>();
    for (const entry of kardexEntries) {
      const current = costByProduct.get(entry.productId) ?? new Decimal(0);
      costByProduct.set(entry.productId, current.plus(entry.totalCostOut ?? 0));
    }

    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, name: true, sku: true, categoryId: true },
    });

    const categories = await this.prisma.category.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return products.map((product) => {
      const revenue = revenueByProduct.get(product.id) ?? new Decimal(0);
      const cost = costByProduct.get(product.id) ?? new Decimal(0);
      const grossProfit = revenue.minus(cost);
      const margin = revenue.gt(0)
        ? grossProfit.div(revenue).mul(100)
        : new Decimal(0);

      return {
        productId: product.id,
        productName: product.name,
        productSku: product.sku ?? '',
        category: categoryMap.get(product.categoryId ?? '') ?? '',
        revenue,
        cost,
        grossProfit,
        margin: Number(margin.toFixed(2)),
      };
    });
  }
}
