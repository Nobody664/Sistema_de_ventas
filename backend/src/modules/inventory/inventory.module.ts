import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { PrismaModule } from '@/database/prisma/prisma.module';
import { KardexModule } from '@/modules/kardex/kardex.module';
import { LowStockModule } from '@/modules/low-stock/low-stock.module';

@Module({
  imports: [PrismaModule, KardexModule, LowStockModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
