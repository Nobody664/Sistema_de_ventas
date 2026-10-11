import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { PlatformAdminsService } from './platform-admins.service';

@Controller('platform/admins')
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformAdminsController {
  constructor(private readonly platformAdminsService: PlatformAdminsService) {}

  @Permissions(Permission.PLATFORM_VIEW)
  @Get()
  list() {
    return this.platformAdminsService.list();
  }

  @Permissions(Permission.PLATFORM_VIEW)
  @Get('candidates')
  listCandidates(@Query('q') query?: string) {
    return this.platformAdminsService.listCandidates(query);
  }

  @Permissions(Permission.PLATFORM_MANAGE_ADMINS)
  @Post(':userId/grant')
  grant(@Param('userId') userId: string) {
    return this.platformAdminsService.grantSupportAdmin(userId);
  }

  @Permissions(Permission.PLATFORM_MANAGE_ADMINS)
  @Post(':userId/revoke')
  revoke(@Param('userId') userId: string, @CurrentUser() user: AuthUser) {
    return this.platformAdminsService.revokeAdmin(userId, user.sub);
  }
}
