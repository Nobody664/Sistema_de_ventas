import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { ReplenishmentService } from './replenishment.service';
import { ForecastService } from './forecast.service';
import { ForecastQueryDto, CoverageQueryDto } from './dto/replenishment.dto';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('replenishment')
export class ReplenishmentController {
  constructor(
    private readonly replenishmentService: ReplenishmentService,
    private readonly forecastService: ForecastService,
  ) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.REPLENISHMENT_VIEW)
  @Get('suggestions')
  suggestions(@Req() request: { tenantId: string }) {
    return this.replenishmentService.getSuggestions(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.REPLENISHMENT_VIEW)
  @Get('coverage/:productId')
  coverage(
    @Req() request: { tenantId: string },
    @Param('productId') productId: string,
    @Query() _query: CoverageQueryDto,
  ) {
    return this.replenishmentService.getCoverageDays(request.tenantId, productId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.FORECAST_VIEW)
  @Get('forecast')
  forecast(@Req() request: { tenantId: string }, @Query() query: ForecastQueryDto) {
    return this.forecastService.getDemandAverages(request.tenantId, query.days ?? 30);
  }
}
