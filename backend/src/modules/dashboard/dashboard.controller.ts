import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { DashboardService } from "./dashboard.service";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { DashboardMetricsQueryDto } from "./dto/dashboard-metrics.dto";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles("SUPER_ADMIN", "SUPPORT_ADMIN")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("global")
  globalMetrics() {
    return this.dashboardService.getGlobalMetrics();
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get("tenant")
  tenantMetrics(
    @Req() request: { tenantId: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboardService.getTenantMetrics(request.tenantId, {
      userId: user.sub,
      roles: user.roles,
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get("metrics")
  metrics(
    @Req() request: { tenantId: string },
    @Query() query: DashboardMetricsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const days = query.days ?? 30;
    const granularity =
      query.granularity ??
      (days <= 31 ? "day" : days <= 120 ? "week" : "month");
    return this.dashboardService.getMetrics(
      request.tenantId,
      days,
      granularity,
      { userId: user.sub, roles: user.roles },
    );
  }
}
