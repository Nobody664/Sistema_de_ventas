import { Module } from "@nestjs/common";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { EmailModule } from "@/modules/email/email.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { LowStockModule } from "@/modules/low-stock/low-stock.module";
import { OutboxService } from "./outbox.service";
import { OutboxController } from "./outbox.controller";

@Module({
  imports: [PrismaModule, EmailModule, NotificationsModule, LowStockModule],
  controllers: [OutboxController],
  providers: [OutboxService],
})
export class OutboxModule {}
