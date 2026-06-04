import { Body, Controller, Get, Param, Post, Patch, Query, Req, UseGuards, DefaultValuePipe, ParseIntPipe, BadRequestException } from '@nestjs/common';
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
  @Get('history')
  getHistory(
    @Req() request: { tenantId: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.paymentsService.getPaymentHistory(request.tenantId, page, limit);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('current-pending')
  getCurrentPending(@Req() request: { tenantId: string }) {
    return this.paymentsService.getCurrentPending(request.tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post(':id/proof')
  uploadProof(
    @Param('id') id: string,
    @Req() request: { tenantId: string },
    @Body() body: { imageBase64: string; paymentDate?: string },
  ) {
    if (!body.imageBase64) {
      throw new BadRequestException('imageBase64 es requerido');
    }
    return this.paymentsService.uploadProofForPayment(
      id,
      request.tenantId,
      body.imageBase64,
      body.paymentDate ? new Date(body.paymentDate) : undefined,
    );
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
  findAllPending(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.paymentsService.findAllPending(page, limit);
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

