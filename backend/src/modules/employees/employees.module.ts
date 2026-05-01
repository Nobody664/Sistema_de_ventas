import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, SubscriptionLimitService],
  exports: [EmployeesService],
})
export class EmployeesModule {}

