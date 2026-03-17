import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { CreateCompanyDto, CreateCompanyWithPlanDto, UpdateCompanyDto, UpdateCompanyStatusDto } from './dto/company.dto';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Get('current')
  findCurrent(@Req() request: { tenantId: string }) {
    return this.companiesService.findCurrent(request.tenantId);
  }

  @Roles('COMPANY_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Patch('current')
  updateCurrent(@Req() request: { tenantId: string }, @Body() body: UpdateCompanyDto) {
    return this.companiesService.updateCurrent(request.tenantId, body);
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  create(@Body() body: CreateCompanyDto) {
    return this.companiesService.create(body);
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('with-plan')
  createWithPlan(@Body() body: CreateCompanyWithPlanDto) {
    return this.companiesService.createWithPlan(body);
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.companiesService.approve(id);
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.companiesService.reject(id);
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCompanyDto) {
    return this.companiesService.update(id, body);
  }

  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateCompanyStatusDto) {
    return this.companiesService.updateStatus(id, body);
  }
}
