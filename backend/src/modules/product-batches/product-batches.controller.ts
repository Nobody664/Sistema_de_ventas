import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { ProductBatchesService } from './product-batches.service';
import { CreateProductBatchDto, UpdateProductBatchDto, ReserveBatchDto, QueryProductBatchDto } from './dto/product-batch.dto';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('product-batches')
export class ProductBatchesController {
  constructor(private readonly productBatchesService: ProductBatchesService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get()
  findAll(@Req() request: { tenantId: string }, @Query() query: QueryProductBatchDto) {
    return this.productBatchesService.findAll(request.tenantId, query);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get('expiring')
  findExpiring(@Req() request: { tenantId: string }, @Query('days') days?: string) {
    return this.productBatchesService.findExpiring(request.tenantId, days ? Number(days) : 7);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get(':id')
  findById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productBatchesService.findById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_INBOUND)
  @Post()
  create(@Req() request: { tenantId: string }, @Body() body: CreateProductBatchDto) {
    return this.productBatchesService.create(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_ADJUST)
  @Patch(':id')
  update(@Req() request: { tenantId: string }, @Param('id') id: string, @Body() body: UpdateProductBatchDto) {
    return this.productBatchesService.update(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_ADJUST)
  @Delete(':id')
  remove(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productBatchesService.remove(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_OUTBOUND)
  @Post(':id/reserve')
  reserve(@Req() request: { tenantId: string }, @Param('id') id: string, @Body() body: ReserveBatchDto) {
    return this.productBatchesService.reserveBatch(request.tenantId, id, body);
  }
}
