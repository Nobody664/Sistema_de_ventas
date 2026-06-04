import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CreateCompanyDto, CreateCompanyWithPlanDto, UpdateCompanyDto, UpdateCompanyStatusDto } from './dto/company.dto';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.COMPANY_VIEW)
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, PermissionsGuard)
  @Get('current')
  findCurrent(@Req() request: { tenantId: string }) {
    return this.companiesService.findCurrent(request.tenantId);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.COMPANY_UPDATE)
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, PermissionsGuard)
  @Patch('current')
  updateCurrent(@Req() request: { tenantId: string }, @Body() body: UpdateCompanyDto) {
    return this.companiesService.updateCurrent(request.tenantId, body);
  }

  @Roles('SUPER_ADMIN')
  @Permissions(Permission.COMPANY_MANAGE_ALL)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.companiesService.findAll(page, limit);
  }

  @Roles('SUPER_ADMIN')
  @Permissions(Permission.COMPANY_MANAGE_ALL)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Roles('SUPER_ADMIN')
  @Permissions(Permission.COMPANY_MANAGE_ALL)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Post()
  create(@Body() body: CreateCompanyDto) {
    return this.companiesService.create(body);
  }

  @Roles('SUPER_ADMIN')
  @Permissions(Permission.COMPANY_MANAGE_ALL, Permission.SUBSCRIPTION_MANAGE)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Post('with-plan')
  createWithPlan(@Body() body: CreateCompanyWithPlanDto) {
    return this.companiesService.createWithPlan(body);
  }

  @Roles('SUPER_ADMIN')
  @Permissions(Permission.COMPANY_MANAGE_ALL)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.companiesService.approve(id);
  }

  @Roles('SUPER_ADMIN')
  @Permissions(Permission.COMPANY_MANAGE_ALL)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.companiesService.reject(id);
  }

  @Roles('SUPER_ADMIN')
  @Permissions(Permission.COMPANY_MANAGE_ALL)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCompanyDto) {
    return this.companiesService.update(id, body);
  }

  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')
  @Permissions(Permission.COMPANY_MANAGE_ALL)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateCompanyStatusDto) {
    return this.companiesService.updateStatus(id, body);
  }
}
