import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequireModule } from '@/modules/plan-capabilities/decorators/require-module.decorator';
import { CreatePurchaseReceiptDto, CreateStockEntryDto } from './dto/stock-entry.dto';
import { StockEntriesService } from './stock-entries.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequireModule('inventory')
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
  @Get('purchases/by-distributor')
  purchasesByDistributor(@Req() request: { tenantId: string }) {
    return this.stockEntriesService.purchasesByDistributor(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get('receipts')
  listReceipts(@Req() request: { tenantId: string }) {
    return this.stockEntriesService.listReceipts(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get('receipts/:id')
  getReceipt(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.stockEntriesService.getReceipt(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_INBOUND)
  @Post('receipts')
  createReceipt(
    @Req() request: { tenantId: string },
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePurchaseReceiptDto,
  ) {
    return this.stockEntriesService.createReceipt(request.tenantId, user?.sub ?? null, body);
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
