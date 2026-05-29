import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CreateInventoryAdjustmentDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get('movements')
  movements(@Req() request: { tenantId: string }) {
    return this.inventoryService.findMovements(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get('low-stock')
  lowStock(@Req() request: { tenantId: string }) {
    return this.inventoryService.findLowStock(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_ADJUST)
  @Post('adjustments')
  adjustStock(@Req() request: { tenantId: string }, @Body() body: CreateInventoryAdjustmentDto) {
    return this.inventoryService.adjustStock(request.tenantId, body);
  }
}
