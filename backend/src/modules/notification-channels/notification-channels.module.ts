import { Module } from "@nestjs/common";
import { EmailModule } from "@/modules/email/email.module";
import { IntegrationsModule } from "@/modules/integrations/integrations.module";
import { NotificationChannelsController } from "./notification-channels.controller";
import { DigestService } from "./digest.service";
import { WebPushService } from "./web-push.service";

@Module({
  imports: [EmailModule, IntegrationsModule],
  controllers: [NotificationChannelsController],
  providers: [DigestService, WebPushService],
  exports: [DigestService],
})
export class NotificationChannelsModule {}
