import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { PlanUpgradeRequestsService } from '@/modules/subscriptions/plan-upgrade-requests.service';
import { ReviewPlanUpgradeDto } from '@/modules/subscriptions/dto/plan-upgrade.dto';

@Controller('platform/upgrade-requests')
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformUpgradeRequestsController {
  constructor(private readonly planUpgradeRequestsService: PlanUpgradeRequestsService) {}

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Get('pending')
  getPending() {
    return this.planUpgradeRequestsService.getPending();
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Post(':id/review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ReviewPlanUpgradeDto,
  ) {
    return this.planUpgradeRequestsService.review(id, user.sub, body);
  }
}
