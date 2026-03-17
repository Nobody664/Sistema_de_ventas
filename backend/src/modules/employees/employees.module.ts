import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, SubscriptionLimitService],
  exports: [EmployeesService],
})
export class EmployeesModule {}

