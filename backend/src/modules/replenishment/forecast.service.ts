import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ForecastService {
  constructor(private readonly prisma: PrismaService) {}

  async getDemandAverage(companyId: string, productId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const sales = await this.prisma.saleItem.findMany({
      where: {
        productId,
        sale: {
          companyId,
          createdAt: { gte: since },
        },
      },
    });

    const totalQty = sales.reduce((sum, s) => sum + s.quantity, 0);
    const dailyAverage = days > 0 ? totalQty / days : 0;

    return {
      productId,
      days,
      totalSold: totalQty,
      dailyAverage: Number(dailyAverage.toFixed(2)),
    };
  }

  async getDemandAverages(companyId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const saleItems = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          companyId,
          createdAt: { gte: since },
        },
      },
      include: {
        sale: { select: { createdAt: true } },
      },
    });

    const productQty = new Map<string, number>();
    for (const item of saleItems) {
      const current = productQty.get(item.productId) ?? 0;
      productQty.set(item.productId, current + item.quantity);
    }

    const products = await this.prisma.product.findMany({
      where: { companyId },
      select: { id: true, name: true, sku: true, salePrice: true, stockQuantity: true },
    });

    const totals = saleItems.reduce(
      (acc, item) => {
        const revenue = acc.revenue.get(item.productId) ?? new Decimal(0);
        acc.revenue.set(item.productId, revenue.plus(item.totalPrice));
        const qty = acc.qty.get(item.productId) ?? 0;
        acc.qty.set(item.productId, qty + item.quantity);
        return acc;
      },
      { revenue: new Map<string, Decimal>(), qty: new Map<string, number>() },
    );

    const totalRevenue = Array.from(totals.revenue.values()).reduce((s, v) => s.plus(v), new Decimal(0));
    const ranked = products
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? '',
        stockQuantity: p.stockQuantity,
        totalSold: totals.qty.get(p.id) ?? 0,
        revenue: totals.revenue.get(p.id) ?? new Decimal(0),
        dailyAverage: Number(((totals.qty.get(p.id) ?? 0) / days).toFixed(2)),
        revenueShare: totalRevenue.gt(0)
          ? Number(((totals.revenue.get(p.id) ?? new Decimal(0)).div(totalRevenue).mul(100)).toFixed(2))
          : 0,
      }))
      .sort((a, b) => Number(b.revenue) - Number(a.revenue));

    let cumulativeShare = 0;
    return ranked.map((p) => {
      cumulativeShare += p.revenueShare;
      let classification: string;
      if (cumulativeShare <= 80) classification = 'A';
      else if (cumulativeShare <= 95) classification = 'B';
      else classification = 'C';
      return { ...p, classification, revenue: Number(p.revenue) };
    });
  }
}
