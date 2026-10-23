import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { SubscriptionAlertsService } from "./subscription-alerts.service";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { EmailModule } from "@/modules/email/email.module";

@Module({
  imports: [PrismaModule, NotificationsModule, EmailModule],
  controllers: [BillingController],
  providers: [BillingService, SubscriptionAlertsService],
  exports: [BillingService],
})
export class BillingModule {}
