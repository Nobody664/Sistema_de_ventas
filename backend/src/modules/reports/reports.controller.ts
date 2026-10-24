import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { RequireModule } from "@/modules/plan-capabilities/decorators/require-module.decorator";
import { RequireFeature } from "@/modules/plan-capabilities/decorators/require-feature.decorator";
import { ReportsService } from "./reports.service";
import { AuthUser, CurrentUser } from "@/common/decorators/current-user.decorator";
import { ReportsOverviewQueryDto } from "./dto/reports-query.dto";

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequireModule("reports")
@RequireFeature("reports.basic")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Permissions(Permission.REPORT_SALES)
  @Get("overview")
  overview(
    @Req() request: { tenantId: string },
    @Query() query: ReportsOverviewQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.getSalesOverview(request.tenantId, query, { userId: user.sub, roles: user.roles });
  }
}
