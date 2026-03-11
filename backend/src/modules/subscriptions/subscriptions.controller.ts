import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @UseGuards(TenantGuard)
  @Get('current')
  findCurrent(@Req() request: { tenantId: string }) {
    return this.subscriptionsService.findByCompany(request.tenantId);
  }

  @UseGuards(TenantGuard)
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

  @UseGuards(TenantGuard)
  @Post('cancel')
  cancel(@Req() request: { tenantId: string }) {
    return this.subscriptionsService.cancelSubscription(request.tenantId);
  }

  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')
  @Get('subscribers')
  findAllSubscribers(
    @Query('status') status?: string,
    @Query('planId') planId?: string,
  ) {
    return this.subscriptionsService.findAllSubscribers({ status, planId });
  }

  @Roles('SUPER_ADMIN')
  @Patch('subscribers/:id/approve')
  approveSubscriber(@Param('id') id: string) {
    return this.subscriptionsService.approveSubscriber(id);
  }

  @Roles('SUPER_ADMIN')
  @Patch('subscribers/:id/reject')
  rejectSubscriber(@Param('id') id: string) {
    return this.subscriptionsService.rejectSubscriber(id);
  }

  @Roles('SUPER_ADMIN')
  @Get('stats')
  getStats() {
    return this.subscriptionsService.getStats();
  }
}
