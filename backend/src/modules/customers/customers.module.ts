import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, SubscriptionLimitService],
  exports: [CustomersService],
})
export class CustomersModule {}

