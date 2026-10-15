import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';
import { LowStockModule } from '@/modules/low-stock/low-stock.module';
import { PrismaModule } from '@/database/prisma/prisma.module';


@Module({
  imports: [PrismaModule, LowStockModule],
  controllers: [ProductsController],
  providers: [ProductsService, SubscriptionLimitService],
  exports: [ProductsService],
})
export class ProductsModule {}

