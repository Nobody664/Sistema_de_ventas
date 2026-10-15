import { Module } from '@nestjs/common';
import { LowStockService } from './low-stock.service';
import { PrismaModule } from '@/database/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [LowStockService],
  exports: [LowStockService],
})
export class LowStockModule {}
