import { Module } from "@nestjs/common";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { AuditCommonModule } from "@/common/services/audit.module";
import { StockEntriesModule } from "@/modules/stock-entries/stock-entries.module";

@Module({
  imports: [PrismaModule, AuditCommonModule, StockEntriesModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
