import { Module } from "@nestjs/common";
import { ProductBatchesController } from "./product-batches.controller";
import { ProductBatchesService } from "./product-batches.service";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { ExpiryAlertsModule } from "@/modules/expiry-alerts/expiry-alerts.module";

@Module({
  imports: [PrismaModule, ExpiryAlertsModule],
  controllers: [ProductBatchesController],
  providers: [ProductBatchesService],
  exports: [ProductBatchesService],
})
export class ProductBatchesModule {}
