import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CreateSaleDto } from './dto/sale.dto';
import { SalesService } from './sales.service';

@UseGuards(TenantGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get()
  findRecentSales(@Req() request: { tenantId: string }) {
    return this.salesService.findRecentSales(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Post()
  createSale(@Req() request: { tenantId: string }, @Body() body: CreateSaleDto) {
    return this.salesService.createSale(request.tenantId, body);
  }
}
