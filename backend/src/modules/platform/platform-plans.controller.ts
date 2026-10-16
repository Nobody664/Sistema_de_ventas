import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CreatePlanDto, UpdatePlanDto } from '@/modules/plans/dto/plan.dto';
import { PlansService } from '@/modules/plans/plans.service';
import { PlatformAuditService } from './platform-audit.service';

@Controller('platform/plans')
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformPlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  @Permissions(Permission.PLATFORM_VIEW)
  @Get()
  findAll() {
    return this.plansService.findAllAdmin();
  }

  @Permissions(Permission.PLATFORM_MANAGE_PLANS)
  @Post()
  async create(@Body() body: CreatePlanDto, @CurrentUser() user: AuthUser) {
    const plan = await this.plansService.create(body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.CREATE,
      entity: 'Plan',
      entityId: plan.id,
      changes: { code: plan.code, name: plan.name },
    });
    return plan;
  }

  @Permissions(Permission.PLATFORM_MANAGE_PLANS)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePlanDto, @CurrentUser() user: AuthUser) {
    const plan = await this.plansService.update(id, body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: 'Plan',
      entityId: id,
      changes: body,
    });
    return plan;
  }

  @Permissions(Permission.PLATFORM_MANAGE_PLANS)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const plan = await this.plansService.remove(id);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.DELETE,
      entity: 'Plan',
      entityId: id,
    });
    return plan;
  }
}
