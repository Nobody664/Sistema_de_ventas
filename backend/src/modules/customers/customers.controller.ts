import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { CustomersService } from './customers.service';

@UseGuards(TenantGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get()
  findByCompany(@Req() request: { tenantId: string }) {
    return this.customersService.findByCompany(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Post()
  create(@Req() request: { tenantId: string }, @Body() body: CreateCustomerDto) {
    return this.customersService.create(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Patch(':id')
  update(@Req() request: { tenantId: string }, @Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.update(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Delete(':id')
  remove(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.customersService.remove(request.tenantId, id);
  }
}
