import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Roles('COMPANY_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Get('status')
  getBillingStatus(@Req() request: { tenantId: string }) {
    return this.billingService.getBillingStatus(request.tenantId);
  }
}
