import { Module } from "@nestjs/common";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { EmailModule } from "@/modules/email/email.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { LowStockModule } from "@/modules/low-stock/low-stock.module";
import { IntegrationsModule } from "@/modules/integrations/integrations.module";
import { NotificationChannelsModule } from "@/modules/notification-channels/notification-channels.module";
import { ExpiryAlertsModule } from "@/modules/expiry-alerts/expiry-alerts.module";
import { OutboxService } from "./outbox.service";
import { OutboxController } from "./outbox.controller";

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    NotificationsModule,
    LowStockModule,
    IntegrationsModule,
    NotificationChannelsModule,
    ExpiryAlertsModule,
  ],
  controllers: [OutboxController],
  providers: [OutboxService],
})
export class OutboxModule {}
