import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles('SUPER_ADMIN')
  @Get('global')
  globalMetrics() {
    return this.dashboardService.getGlobalMetrics();
  }

  @UseGuards(TenantGuard)
  @Get('tenant')
  tenantMetrics(@Req() request: { tenantId: string }) {
    return this.dashboardService.getTenantMetrics(request.tenantId);
  }
}

