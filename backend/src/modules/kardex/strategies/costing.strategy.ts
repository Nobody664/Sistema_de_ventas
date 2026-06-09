import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';

type PrismaTx = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$use' | '$extends'>;

export interface CostingResult {
  unitCost: Decimal;
  totalCost: Decimal;
}

export interface CostingStrategy {
  name: string;
  calculateOutCost(
    productId: string,
    quantity: number,
    companyId: string,
    tx: PrismaTx,
  ): Promise<CostingResult>;
}
