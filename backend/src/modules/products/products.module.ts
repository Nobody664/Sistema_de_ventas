import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { SubscriptionLimitService } from "@/common/guards/subscription-limit.service";
import { LowStockModule } from "@/modules/low-stock/low-stock.module";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { BarcodeResolutionService } from "./barcode-resolution.service";

@Module({
  imports: [PrismaModule, LowStockModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    SubscriptionLimitService,
    BarcodeResolutionService,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
