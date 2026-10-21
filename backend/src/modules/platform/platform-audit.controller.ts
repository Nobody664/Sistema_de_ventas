import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditAction } from "@prisma/client";

import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { AuditService } from "@/common/services/audit.service";

interface AuditQueryDto {
  userId?: string;
  entity?: string;
  action?: AuditAction;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}

@Controller("platform/audit")
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Permissions(Permission.PLATFORM_VIEW_AUDIT)
  @Get()
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
}
