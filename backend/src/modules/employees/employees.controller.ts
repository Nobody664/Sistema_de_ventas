import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeesService } from './employees.service';

@UseGuards(TenantGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Get()
  findByCompany(@Req() request: { tenantId: string }) {
    return this.employeesService.findByCompany(request.tenantId);
  }

  @Roles('COMPANY_ADMIN')
  @Post()
  create(@Req() request: { tenantId: string }, @Body() body: CreateEmployeeDto) {
    return this.employeesService.create(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN')
  @Patch(':id')
  update(@Req() request: { tenantId: string }, @Param('id') id: string, @Body() body: UpdateEmployeeDto) {
    return this.employeesService.update(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Delete(':id')
  remove(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.employeesService.remove(request.tenantId, id);
  }
}
