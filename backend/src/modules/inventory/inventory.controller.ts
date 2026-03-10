import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CreateInventoryAdjustmentDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@UseGuards(TenantGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Get('movements')
  movements(@Req() request: { tenantId: string }) {
    return this.inventoryService.findMovements(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Get('low-stock')
  lowStock(@Req() request: { tenantId: string }) {
    return this.inventoryService.findLowStock(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Post('adjustments')
  adjustStock(@Req() request: { tenantId: string }, @Body() body: CreateInventoryAdjustmentDto) {
    return this.inventoryService.adjustStock(request.tenantId, body);
  }
}
