import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { ForecastService } from './forecast.service';

@Injectable()
export class ReplenishmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastService: ForecastService,
  ) {}

  async getSuggestions(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        reorderPoint: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        reorderPoint: true,
        safetyStock: true,
        leadTimeDays: true,
      },
    });

    const suggestions: Array<{
      productId: string;
      productName: string;
      sku: string;
      currentStock: number;
      reorderPoint: number;
      suggestedOrder: number;
      priority: string;
    }> = [];

    for (const product of products) {
      const stock = product.stockQuantity;
      const reorderPoint = product.reorderPoint ?? 0;

      if (stock >= reorderPoint) continue;

      const demand = await this.forecastService.getDemandAverage(companyId, product.id, 30);
      const dailyAverage = demand.dailyAverage || 1;
      const leadTime = product.leadTimeDays ?? 7;
      const safetyStock = product.safetyStock ?? Math.ceil(dailyAverage * 3);

      const suggestedOrder = Math.ceil(
        dailyAverage * leadTime + safetyStock - stock,
      );

      const stockoutRisk = stock <= safetyStock ? 'high' : 'medium';

      suggestions.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku ?? '',
        currentStock: stock,
        reorderPoint,
        suggestedOrder: Math.max(suggestedOrder, 0),
        priority: stockoutRisk,
      });
    }

    suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
    });

    return suggestions;
  }

  async getCoverageDays(companyId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!product) throw new Error('Product not found');

    const demand = await this.forecastService.getDemandAverage(companyId, productId, 30);
    const dailyAverage = demand.dailyAverage;

    const coverageDays = dailyAverage > 0
      ? Math.floor(product.stockQuantity / dailyAverage)
      : Infinity;

    return {
      productId,
      productName: product.name,
      currentStock: product.stockQuantity,
      dailyAverage,
      coverageDays: coverageDays === Infinity ? null : coverageDays,
    };
  }
}
