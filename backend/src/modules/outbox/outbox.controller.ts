import { Controller, Get, Post, Param, UseGuards } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { EntityIdPipe } from "@/common/pipes/entity-id.pipe";
import { OutboxService } from "./outbox.service";

@Controller("platform/outbox")
@Roles("SUPER_ADMIN")
@Permissions(Permission.PLATFORM_MANAGE_SETTINGS)
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class OutboxController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}
  @Get()
  list() {
    return this.prisma.outboxEvent.findMany({
      where: { processedAt: null },
      select: {
        id: true,
        kind: true,
        aggregateId: true,
        attempts: true,
        availableAt: true,
        lockedAt: true,
        processedAt: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }
  @Post(":id/retry")
  retry(@Param("id", EntityIdPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.outbox.retry(id, actor.sub);
  }
}
