import { Body, Controller, Get, Param, Post, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get()
  findAll(@Req() request: { tenantId: string }) {
    return this.paymentsService.findByCompany(request.tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('pending')
  findPending(@Req() request: { tenantId: string }) {
    return this.paymentsService.findPendingByCompany(request.tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: { tenantId: string }) {
    return this.paymentsService.findOne(id, request.tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get(':id/receipt')
  getReceipt(@Param('id') id: string, @Req() request: { tenantId: string }) {
    return this.paymentsService.generateReceipt(id, request.tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Patch(':id/mark-paid')
  markAsPaid(
    @Param('id') id: string,
    @Req() request: { tenantId: string },
    @Body() body: { paymentDate?: string },
  ) {
    return this.paymentsService.markAsPaid(id, request.tenantId, body.paymentDate);
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/pending')
  findAllPending() {
    return this.paymentsService.findAllPending();
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/stats')
  getStats() {
    return this.paymentsService.getStats();
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('checkout-session/:provider')
  createCheckoutSession(
    @Param('provider') provider: string,
    @Body() body: { planCode: string },
    @Req() request: { tenantId: string },
  ) {
    return this.paymentsService.createCheckoutSession({
      companyId: request.tenantId,
      planCode: body.planCode,
      provider,
    });
  }

  @Public()
  @Post('webhooks/:provider')
  handleWebhook(@Param('provider') provider: string, @Body() payload: unknown) {
    return this.paymentsService.handleWebhook(provider, payload);
  }
}

