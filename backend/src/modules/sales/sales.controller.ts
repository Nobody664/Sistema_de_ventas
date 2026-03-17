import { Body, Controller, Get, Post, Req, UseGuards, Query, Logger, Param } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CreateSaleDto, ExportSalesQueryDto } from './dto/sale.dto';
import { SalesService } from './sales.service';
import { PrismaService } from '@/database/prisma/prisma.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SalesController {
  private readonly logger = new Logger(SalesController.name);

  constructor(
    private readonly salesService: SalesService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('test')
  async testSales(@Req() request: { tenantId: string }) {
    try {
      const tenantId = request.tenantId || 'test-company-id';
      const sales = await this.prisma.sale.findMany({
        where: { companyId: tenantId },
        take: 5,
      });
      return { success: true, count: sales.length, sales };
    } catch (error) {
      this.logger.error('Test error:', error);
      return { success: false, error: String(error) };
    }
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Get('export')
  exportSales(
    @Req() request: { tenantId: string },
    @Query() query: ExportSalesQueryDto,
  ) {
    return this.salesService.exportSales(request.tenantId, query);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get(':id')
  findById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.salesService.findById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
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
  @Post()
  createSale(@Req() request: { tenantId: string }, @Body() body: CreateSaleDto) {
    return this.salesService.createSale(request.tenantId, body);
  }
}
