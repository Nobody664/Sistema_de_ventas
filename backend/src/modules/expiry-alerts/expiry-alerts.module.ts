import { Module } from "@nestjs/common";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { ExpiryAlertsService } from "./expiry-alerts.service";
import { ExpiryAlertsController } from "./expiry-alerts.controller";

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [ExpiryAlertsService],
  controllers: [ExpiryAlertsController],
  exports: [ExpiryAlertsService],
})
export class ExpiryAlertsModule {}
