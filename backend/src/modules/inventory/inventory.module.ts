import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { KardexModule } from "@/modules/kardex/kardex.module";
import { LowStockModule } from "@/modules/low-stock/low-stock.module";
import { ProductBatchesModule } from "@/modules/product-batches/product-batches.module";

@Module({
  imports: [PrismaModule, KardexModule, LowStockModule, ProductBatchesModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
