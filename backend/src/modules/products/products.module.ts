import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ProductsController],
  providers: [ProductsService, SubscriptionLimitService],
  exports: [ProductsService],
})
export class ProductsModule {}

