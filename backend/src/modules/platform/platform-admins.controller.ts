import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuditAction } from "@prisma/client";

import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { PlatformAdminsService } from "./platform-admins.service";
import { PlatformAuditService } from "./platform-audit.service";

@Controller("platform/admins")
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformAdminsController {
  constructor(
    private readonly platformAdminsService: PlatformAdminsService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  @Permissions(Permission.PLATFORM_VIEW)
  @Get()
  list() {
    return this.platformAdminsService.list();
  }

  @Permissions(Permission.PLATFORM_VIEW)
  @Get("candidates")
  listCandidates(@Query("q") query?: string) {
    return this.platformAdminsService.listCandidates(query);
  }

  @Permissions(Permission.PLATFORM_MANAGE_ADMINS)
  @Post(":userId/grant")
  async grant(@Param("userId") userId: string, @CurrentUser() user: AuthUser) {
    const result = await this.platformAdminsService.grantSupportAdmin(userId);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "User",
      entityId: userId,
      changes: { globalRole: "SUPPORT_ADMIN" },
    });
    return result;
  }

  @Permissions(Permission.PLATFORM_MANAGE_ADMINS)
  @Post(":userId/revoke")
  async revoke(@Param("userId") userId: string, @CurrentUser() user: AuthUser) {
    const result = await this.platformAdminsService.revokeAdmin(
      userId,
      user.sub,
    );
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "User",
      entityId: userId,
      changes: { globalRole: "USER" },
    });
    return result;
  }
}
