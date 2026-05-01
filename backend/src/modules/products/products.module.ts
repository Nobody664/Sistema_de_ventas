import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ProductsController],
  providers: [ProductsService, SubscriptionLimitService],
  exports: [ProductsService],
})
export class ProductsModule {}

