import { Body, Controller, Get, Post, Req, UseGuards, Query, Logger, Param } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CreateSaleDto, ExportSalesQueryDto } from './dto/sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SalesController {
  private readonly logger = new Logger(SalesController.name);

  constructor(private readonly salesService: SalesService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.SALE_EXPORT)
  @Get('export')
  exportSales(
    @Req() request: { tenantId: string },
    @Query() query: ExportSalesQueryDto,
  ) {
    return this.salesService.exportSales(request.tenantId, query);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.SALE_VIEW_DETAIL)
  @Get(':id')
  findById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.salesService.findById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.SALE_LIST)
  @Get()
  async findRecentSales(@Req() request: { tenantId: string }) {
    try {
      this.logger.log(`[SalesController] Fetching sales for tenant: ${request.tenantId}`);
      const sales = await this.salesService.findRecentSales(request.tenantId);
      this.logger.log(`[SalesController] Found ${sales.length} sales`);
      return sales;
    } catch (error) {
      this.logger.error('[SalesController] Error fetching sales:', error);
      throw error;
    }
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.SALE_CREATE)
  @Post()
  createSale(@Req() request: { tenantId: string }, @Body() body: CreateSaleDto) {
    return this.salesService.createSale(request.tenantId, body);
  }
}
