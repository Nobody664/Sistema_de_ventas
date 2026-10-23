import { Module } from "@nestjs/common";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { DistributorsModule } from "@/modules/distributors/distributors.module";
import { StockExitsController } from "./stock-exits.controller";
import { StockExitsService } from "./stock-exits.service";

@Module({
  imports: [PrismaModule, DistributorsModule],
  controllers: [StockExitsController],
  providers: [StockExitsService],
})
export class StockExitsModule {}
