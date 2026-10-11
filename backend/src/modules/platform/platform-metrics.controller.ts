import { Controller, Get, UseGuards } from '@nestjs/common';

import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { PlatformMetricsService } from './platform-metrics.service';

@Controller('platform/metrics')
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformMetricsController {
  constructor(private readonly platformMetricsService: PlatformMetricsService) {}

  @Permissions(Permission.PLATFORM_VIEW)
  @Get('overview')
  getOverview() {
    return this.platformMetricsService.getOverview();
  }
}
