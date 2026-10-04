import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { PrismaModule } from '@/database/prisma/prisma.module';
import { AuditCommonModule } from '@/common/services/audit.module';

@Module({
  imports: [PrismaModule, AuditCommonModule],
  controllers: [AuditController],
})
export class AuditModule {}