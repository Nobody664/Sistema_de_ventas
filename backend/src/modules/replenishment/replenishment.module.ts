import { Module } from '@nestjs/common';
import { ReplenishmentController } from './replenishment.controller';
import { ReplenishmentService } from './replenishment.service';
import { ForecastService } from './forecast.service';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReplenishmentController],
  providers: [ReplenishmentService, ForecastService],
  exports: [ReplenishmentService, ForecastService],
})
export class ReplenishmentModule {}
