import { Module } from '@nestjs/common';
import { ProductBatchesController } from './product-batches.controller';
import { ProductBatchesService } from './product-batches.service';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProductBatchesController],
  providers: [ProductBatchesService],
  exports: [ProductBatchesService],
})
export class ProductBatchesModule {}
