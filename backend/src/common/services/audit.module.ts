import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditContextService } from './audit-context.service';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditService, AuditContextService],
  exports: [AuditService, AuditContextService],
})
export class AuditCommonModule {}