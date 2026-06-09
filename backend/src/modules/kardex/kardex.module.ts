import { Module } from '@nestjs/common';
import { KardexController } from './kardex.controller';
import { KardexService } from './kardex.service';
import { FifoStrategy } from './strategies/fifo.strategy';
import { WeightedAverageStrategy } from './strategies/weighted-average.strategy';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [KardexController],
  providers: [
    KardexService,
    FifoStrategy,
    WeightedAverageStrategy,
  ],
  exports: [KardexService],
})
export class KardexModule {}
