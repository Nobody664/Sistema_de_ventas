import { Module } from "@nestjs/common";
import { DistributorsController } from "./distributors.controller";
import { DistributorsService } from "./distributors.service";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { KardexModule } from "@/modules/kardex/kardex.module";
import { LowStockModule } from "@/modules/low-stock/low-stock.module";
import { ProductBatchesModule } from "@/modules/product-batches/product-batches.module";

@Module({
  imports: [PrismaModule, KardexModule, LowStockModule, ProductBatchesModule],
  controllers: [DistributorsController],
  providers: [DistributorsService],
  exports: [DistributorsService],
})
export class DistributorsModule {}
