import { Module } from '@nestjs/common';
import { DistributorsController } from './distributors.controller';
import { DistributorsService } from './distributors.service';
import { PrismaModule } from '@/database/prisma/prisma.module';
import { KardexModule } from '@/modules/kardex/kardex.module';
import { ProductBatchesModule } from '@/modules/product-batches/product-batches.module';

@Module({
  imports: [PrismaModule, KardexModule, ProductBatchesModule],
  controllers: [DistributorsController],
  providers: [DistributorsService],
  exports: [DistributorsService],
})
export class DistributorsModule {}
