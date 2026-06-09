import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { KardexModule } from '@/modules/kardex/kardex.module';
import { ProductBatchesModule } from '@/modules/product-batches/product-batches.module';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Module({
  imports: [NotificationsModule, KardexModule, ProductBatchesModule, PrismaModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}

