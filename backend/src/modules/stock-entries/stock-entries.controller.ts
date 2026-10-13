import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CreateStockEntryDto } from './dto/stock-entry.dto';
import { StockEntriesService } from './stock-entries.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('stock-entries')
export class StockEntriesController {
  constructor(private readonly stockEntriesService: StockEntriesService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get()
  findAll(@Req() request: { tenantId: string }) {
    return this.stockEntriesService.findAll(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get(':id')
  findById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.stockEntriesService.findById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_INBOUND)
  @Post()
  create(@Req() request: { tenantId: string }, @Body() body: CreateStockEntryDto) {
    return this.stockEntriesService.create(request.tenantId, body);
  }
}
