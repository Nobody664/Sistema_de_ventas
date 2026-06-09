import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { KardexService } from './kardex.service';
import { QueryKardexDto } from './dto/kardex.dto';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('kardex')
export class KardexController {
  constructor(private readonly kardexService: KardexService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.KARDEX_VIEW)
  @Get()
  query(@Req() request: { tenantId: string }, @Query() query: QueryKardexDto) {
    return this.kardexService.query(request.tenantId, query);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.KARDEX_VIEW)
  @Get('products/:id')
  productKardex(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.kardexService.query(request.tenantId, { productId: id });
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.KARDEX_VIEW)
  @Get('summary')
  summary(@Req() request: { tenantId: string }) {
    return this.kardexService.getSummary(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.REPORT_FINANCIAL)
  @Get('profitability')
  profitability(
    @Req() request: { tenantId: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.kardexService.getProfitability(request.tenantId, startDate, endDate);
  }
}
