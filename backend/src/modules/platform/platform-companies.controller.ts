import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import {
  CreateCompanyDto,
  CreateCompanyWithPlanDto,
  UpdateCompanyDto,
  UpdateCompanyStatusDto,
} from '@/modules/companies/dto/company.dto';
import { CompaniesService } from '@/modules/companies/companies.service';

@Controller('platform/companies')
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformCompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Permissions(Permission.PLATFORM_VIEW)
  @Get()
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.companiesService.findAll(page, limit);
  }

  @Permissions(Permission.PLATFORM_VIEW)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Post()
  create(@Body() body: CreateCompanyDto) {
    return this.companiesService.create(body);
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Post('with-plan')
  createWithPlan(@Body() body: CreateCompanyWithPlanDto) {
    return this.companiesService.createWithPlan(body);
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.companiesService.approve(id);
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.companiesService.reject(id);
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCompanyDto) {
    return this.companiesService.update(id, body);
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateCompanyStatusDto) {
    return this.companiesService.updateStatus(id, body);
  }
}
