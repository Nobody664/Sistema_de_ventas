import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Module({
  imports: [NotificationsModule, PrismaModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}

