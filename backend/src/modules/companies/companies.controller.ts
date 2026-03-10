import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { UpdateCompanyDto, UpdateCompanyStatusDto } from './dto/company.dto';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Roles('SUPER_ADMIN')
  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @UseGuards(TenantGuard)
  @Get('current')
  findCurrent(@Req() request: { tenantId: string }) {
    return this.companiesService.findCurrent(request.tenantId);
  }

  @Roles('COMPANY_ADMIN')
  @UseGuards(TenantGuard)
  @Patch('current')
  updateCurrent(@Req() request: { tenantId: string }, @Body() body: UpdateCompanyDto) {
    return this.companiesService.updateCurrent(request.tenantId, body);
  }

  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateCompanyStatusDto) {
    return this.companiesService.updateStatus(id, body);
  }
}
