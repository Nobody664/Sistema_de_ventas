import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { NotificationStreamService } from "./notification-stream.service";

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationStreamService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
