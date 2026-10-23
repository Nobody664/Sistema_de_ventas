import { Module } from "@nestjs/common";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { CreditNotesController } from "./credit-notes.controller";
import { CreditNotesService } from "./credit-notes.service";

@Module({
  imports: [PrismaModule],
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
