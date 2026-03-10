import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles('SUPER_ADMIN')
  @Get('global')
  globalAudit() {
    return this.auditService.findRecent();
  }

  @UseGuards(TenantGuard)
  @Get('tenant')
  tenantAudit(@Req() request: { tenantId: string }) {
    return this.auditService.findRecent(request.tenantId);
  }
}

