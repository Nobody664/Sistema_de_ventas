import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { SubscriptionLimitGuard, LimitResource } from '@/common/guards/subscription-limit.guard';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { CustomersService } from './customers.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.CUSTOMER_LIST)
  @Get('limits')
  getLimits(@Req() request: { tenantId: string }) {
    return this.customersService.getLimitsInfo(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.CUSTOMER_LIST)
  @Get(':id')
  findById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.customersService.findById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.CUSTOMER_LIST)
  @Get(':id/purchases')
  getPurchases(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.customersService.getPurchases(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.CUSTOMER_LIST)
  @Get()
  findByCompany(@Req() request: { tenantId: string }) {
    return this.customersService.findByCompany(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.CUSTOMER_CREATE)
  @UseGuards(SubscriptionLimitGuard)
  @LimitResource('customers')
  @Post()
  create(@Req() request: { tenantId: string }, @Body() body: CreateCustomerDto) {
    return this.customersService.create(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.CUSTOMER_UPDATE)
  @Patch(':id')
  update(@Req() request: { tenantId: string }, @Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.update(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.CUSTOMER_DELETE)
  @Delete(':id')
  remove(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.customersService.remove(request.tenantId, id);
  }
}
