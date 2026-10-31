import { Module } from "@nestjs/common";
import { LowStockService } from "./low-stock.service";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { ExpiryAlertsModule } from "@/modules/expiry-alerts/expiry-alerts.module";

@Module({
  imports: [PrismaModule, NotificationsModule, ExpiryAlertsModule],
  providers: [LowStockService],
  exports: [LowStockService],
})
export class LowStockModule {}
