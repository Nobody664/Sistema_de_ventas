import { Module } from "@nestjs/common";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { SupportTicketsService } from "./support-tickets.service";
import { SupportTicketsController } from "./support-tickets.controller";
import { SupportChatService } from "./support-chat.service";
import { SupportChatController } from "./support-chat.controller";
import { SupportFaqService } from "./support-faq.service";
import { SupportFaqController } from "./support-faq.controller";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    SupportTicketsController,
    SupportChatController,
    SupportFaqController,
  ],
  providers: [SupportTicketsService, SupportChatService, SupportFaqService],
  exports: [SupportTicketsService, SupportChatService, SupportFaqService],
})
export class SupportModule {}
