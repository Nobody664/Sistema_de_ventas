import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { AuditService } from '@/common/services/audit.service';

interface AuditQueryDto {
  userId?: string;
  entity?: string;
  action?: AuditAction;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('global')
  globalAudit(@Query() query: AuditQueryDto) {
    return this.auditService.findMany({
      userId: query.userId,
      entity: query.entity,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('tenant')
  tenantAudit(@Req() request: { tenantId: string }, @Query() query: AuditQueryDto) {
    return this.auditService.findMany({
      companyId: request.tenantId,
      userId: query.userId,
      entity: query.entity,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }
}