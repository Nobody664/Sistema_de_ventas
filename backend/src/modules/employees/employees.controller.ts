import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { SubscriptionLimitGuard, LimitResource } from '@/common/guards/subscription-limit.guard';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeesService } from './employees.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.EMPLOYEE_LIST)
  @Get('limits')
  getLimits(@Req() request: { tenantId: string }) {
    return this.employeesService.getLimitsInfo(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.EMPLOYEE_LIST)
  @Get(':id')
  findById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.employeesService.findById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.EMPLOYEE_LIST)
  @Get()
  findByCompany(@Req() request: { tenantId: string }) {
    return this.employeesService.findByCompany(request.tenantId);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.EMPLOYEE_CREATE)
  @UseGuards(SubscriptionLimitGuard)
  @LimitResource('employees')
  @Post()
  create(@Req() request: { tenantId: string }, @Body() body: CreateEmployeeDto) {
    return this.employeesService.create(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.EMPLOYEE_UPDATE)
  @Patch(':id')
  update(@Req() request: { tenantId: string }, @Param('id') id: string, @Body() body: UpdateEmployeeDto) {
    return this.employeesService.update(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.EMPLOYEE_DELETE)
  @Delete(':id')
  remove(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.employeesService.remove(request.tenantId, id);
  }
}
