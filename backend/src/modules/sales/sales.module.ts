import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { LowStockModule } from "@/modules/low-stock/low-stock.module";
import { KardexModule } from "@/modules/kardex/kardex.module";
import { ProductBatchesModule } from "@/modules/product-batches/product-batches.module";
import { DistributorsModule } from "@/modules/distributors/distributors.module";
import { DiscountsModule } from "@/modules/discounts/discounts.module";
import { CreditNotesModule } from "@/modules/credit-notes/credit-notes.module";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { SubscriptionLimitService } from "@/common/guards/subscription-limit.service";

@Module({
  imports: [
    NotificationsModule,
    LowStockModule,
    KardexModule,
    ProductBatchesModule,
    DistributorsModule,
    DiscountsModule,
    CreditNotesModule,
    PrismaModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, SubscriptionLimitService],
  exports: [SalesService],
})
export class SalesModule {}
