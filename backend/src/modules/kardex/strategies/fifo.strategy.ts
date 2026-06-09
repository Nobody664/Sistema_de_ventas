import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CostingStrategy, CostingResult } from './costing.strategy';

type PrismaTx = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$use' | '$extends'>;

interface InventoryLayer {
  qty: number;
  unitCost: Decimal;
}

@Injectable()
export class FifoStrategy implements CostingStrategy {
  name = 'FIFO';

  async calculateOutCost(
    productId: string,
    quantity: number,
    companyId: string,
    tx: PrismaTx,
  ): Promise<CostingResult> {
    const entries = await tx.inventoryKardex.findMany({
      where: { companyId, productId },
      orderBy: { movementDate: 'asc' },
    });

    const layers: InventoryLayer[] = [];

    for (const entry of entries) {
      if (entry.qtyIn > 0 && entry.unitCostIn) {
        layers.push({ qty: entry.qtyIn, unitCost: entry.unitCostIn });
      } else if (entry.qtyOut > 0) {
        let remaining = entry.qtyOut;
        while (remaining > 0 && layers.length > 0) {
          const layer = layers[0];
          const consumed = Math.min(layer.qty, remaining);
          layer.qty -= consumed;
          remaining -= consumed;
          if (layer.qty <= 0) layers.shift();
        }
      }
    }

    let remainingToConsume = quantity;
    let totalCost = new Decimal(0);

    while (remainingToConsume > 0 && layers.length > 0) {
      const layer = layers[0];
      const consumed = Math.min(layer.qty, remainingToConsume);
      totalCost = totalCost.plus(layer.unitCost.mul(consumed));
      layer.qty -= consumed;
      remainingToConsume -= consumed;
      if (layer.qty <= 0) layers.shift();
    }

    if (remainingToConsume > 0) {
      throw new Error(`Insufficient inventory layers for product ${productId}. Needed ${quantity}, found ${quantity - remainingToConsume}`);
    }

    const unitCost = totalCost.div(quantity);
    return { unitCost, totalCost };
  }
}
