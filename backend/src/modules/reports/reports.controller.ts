import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Permissions(Permission.REPORT_SALES)
  @Get('overview')
  overview(@Req() request: { tenantId: string }) {
    return this.reportsService.getSalesOverview(request.tenantId);
  }
}

