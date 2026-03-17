import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Get('current')
  findCurrent(@Req() request: { tenantId: string }) {
    return this.subscriptionsService.findByCompany(request.tenantId);
  }

  @Roles('COMPANY_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Post('upgrade')
  upgrade(
    @Req() request: { tenantId: string },
    @Body() body: { planCode: string; billingCycle?: 'MONTHLY' | 'YEARLY' },
  ) {
    return this.subscriptionsService.upgradePlan(
      request.tenantId,
      body.planCode,
      body.billingCycle,
    );
  }

  @Roles('COMPANY_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Post('cancel')
  cancel(@Req() request: { tenantId: string }) {
    return this.subscriptionsService.cancelSubscription(request.tenantId);
  }

  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('subscribers')
  findAllSubscribers(
    @Query('status') status?: string,
    @Query('planId') planId?: string,
  ) {
    return this.subscriptionsService.findAllSubscribers({ status, planId });
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('subscribers/:id/approve')
  approveSubscriber(@Param('id') id: string) {
    return this.subscriptionsService.approveSubscriber(id);
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('subscribers/:id/reject')
  rejectSubscriber(@Param('id') id: string) {
    return this.subscriptionsService.rejectSubscriber(id);
  }

  @Roles('SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('stats')
  getStats() {
    return this.subscriptionsService.getStats();
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Get('limits/:resource')
  checkLimits(
    @Req() request: { tenantId: string },
    @Param('resource') resource: 'users' | 'products',
  ) {
    return this.subscriptionsService.checkPlanLimits(request.tenantId, resource);
  }
}
