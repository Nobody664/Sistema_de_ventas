import { Module } from '@nestjs/common';
import { StockEntriesController } from './stock-entries.controller';
import { StockEntriesService } from './stock-entries.service';
import { PrismaModule } from '@/database/prisma/prisma.module';
import { KardexModule } from '@/modules/kardex/kardex.module';

@Module({
  imports: [PrismaModule, KardexModule],
  controllers: [StockEntriesController],
  providers: [StockEntriesService],
  exports: [StockEntriesService],
})
export class StockEntriesModule {}
