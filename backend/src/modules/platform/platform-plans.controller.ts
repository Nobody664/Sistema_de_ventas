import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CreatePlanDto, UpdatePlanDto } from '@/modules/plans/dto/plan.dto';
import { PlansService } from '@/modules/plans/plans.service';

@Controller('platform/plans')
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformPlansController {
  constructor(private readonly plansService: PlansService) {}

  @Permissions(Permission.PLATFORM_VIEW)
  @Get()
  findAll() {
    return this.plansService.findAllAdmin();
  }

  @Permissions(Permission.PLATFORM_MANAGE_PLANS)
  @Post()
  create(@Body() body: CreatePlanDto) {
    return this.plansService.create(body);
  }

  @Permissions(Permission.PLATFORM_MANAGE_PLANS)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePlanDto) {
    return this.plansService.update(id, body);
  }

  @Permissions(Permission.PLATFORM_MANAGE_PLANS)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
