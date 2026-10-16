import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { PlatformAuditService } from './platform-audit.service';

@Controller('platform/subscriptions')
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformSubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

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
  async approveSubscriber(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const subscription = await this.subscriptionsService.approveSubscriber(id);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: 'Subscription',
      entityId: id,
      changes: { status: 'ACTIVE' },
    });
    return subscription;
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Patch('subscribers/:id/reject')
  async rejectSubscriber(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const subscription = await this.subscriptionsService.rejectSubscriber(id);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: 'Subscription',
      entityId: id,
      changes: { status: 'CANCELED' },
    });
    return subscription;
  }
}
