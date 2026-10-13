import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CostingStrategy, CostingResult } from './costing.strategy';

type PrismaTx = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$use' | '$extends'>;

@Injectable()
export class WeightedAverageStrategy implements CostingStrategy {
  name = 'WEIGHTED_AVERAGE';

  async calculateOutCost(
    productId: string,
    quantity: Prisma.Decimal,
    companyId: string,
    tx: PrismaTx,
  ): Promise<CostingResult> {
    const lastEntry = await tx.inventoryKardex.findFirst({
      where: { productId, companyId },
      orderBy: { movementDate: 'desc' },
    });

    if (!lastEntry || lastEntry.balanceQty.lte(0)) {
      throw new Error(`No inventory balance found for product ${productId}`);
    }

    const unitCost = lastEntry.balanceUnitCost;
    const totalCost = unitCost.mul(quantity);
    return { unitCost, totalCost };
  }
}
