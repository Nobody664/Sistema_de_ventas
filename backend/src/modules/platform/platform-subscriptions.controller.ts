import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';

@Controller('platform/subscriptions')
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Permissions(Permission.PLATFORM_VIEW)
  @Get('subscribers')
  findAllSubscribers(
    @Query('status') status?: string,
    @Query('planId') planId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.subscriptionsService.findAllSubscribers({ status, planId, page, limit });
  }

  @Permissions(Permission.PLATFORM_VIEW)
  @Get('stats')
  getStats() {
    return this.subscriptionsService.getStats();
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Patch('subscribers/:id/approve')
  approveSubscriber(@Param('id') id: string) {
    return this.subscriptionsService.approveSubscriber(id);
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Patch('subscribers/:id/reject')
  rejectSubscriber(@Param('id') id: string) {
    return this.subscriptionsService.rejectSubscriber(id);
  }
}
