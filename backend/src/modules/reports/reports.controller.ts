import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  overview(@Req() request: { tenantId: string }) {
    return this.reportsService.getSalesOverview(request.tenantId);
  }
}

