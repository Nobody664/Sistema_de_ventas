import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditCommonModule } from '@/common/services/audit.module';

@Module({
  imports: [AuditCommonModule],
  controllers: [AuditController],
})
export class AuditModule {}