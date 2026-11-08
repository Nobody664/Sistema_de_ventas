import { Module } from "@nestjs/common";
import { ProductBatchesController } from "./product-batches.controller";
import { ProductBatchesService } from "./product-batches.service";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { ExpiryAlertsModule } from "@/modules/expiry-alerts/expiry-alerts.module";
import { BatchExpiryController } from "./batch-expiry.controller";
import { BatchExpiryService } from "./batch-expiry.service";

@Module({
  imports: [PrismaModule, ExpiryAlertsModule],
  controllers: [ProductBatchesController, BatchExpiryController],
  providers: [ProductBatchesService, BatchExpiryService],
  exports: [ProductBatchesService],
})
export class ProductBatchesModule {}
