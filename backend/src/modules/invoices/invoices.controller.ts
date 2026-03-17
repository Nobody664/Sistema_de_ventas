import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, Query } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from './dto/invoice.dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Roles('SUPER_ADMIN')
  @Get('templates')
  findTemplates(@Req() request: { tenantId: string }) {
    return this.invoicesService.findTemplates(request.tenantId);
  }

  @Roles('SUPER_ADMIN')
  @Get('templates/:id')
  findTemplateById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.invoicesService.findTemplateById(id, request.tenantId);
  }

  @Roles('SUPER_ADMIN')
  @Post('templates/global')
  createGlobalTemplate(@Body() body: CreateInvoiceTemplateDto) {
    return this.invoicesService.create('', true, body);
  }

  @Roles('SUPER_ADMIN')
  @Post('templates')
  createTemplate(@Req() request: { tenantId: string }, @Body() body: CreateInvoiceTemplateDto) {
    return this.invoicesService.create('', true, body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('templates/:id')
  updateTemplate(
    @Req() request: { tenantId: string },
    @Param('id') id: string,
    @Body() body: UpdateInvoiceTemplateDto,
  ) {
    return this.invoicesService.update(id, request.tenantId, body);
  }

  @Roles('SUPER_ADMIN')
  @Delete('templates/:id')
  removeTemplate(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.invoicesService.remove(id, request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get('templates/default')
  getDefaultTemplate(@Req() request: { tenantId: string }) {
    return this.invoicesService.getDefaultTemplate(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get('generate/:saleId')
  generateInvoice(
    @Req() request: { tenantId: string },
    @Param('saleId') saleId: string,
    @Query('templateId') templateId?: string,
  ) {
    return this.invoicesService.generateInvoiceHtml(saleId, request.tenantId, templateId);
  }
}
