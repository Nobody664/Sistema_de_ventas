import { Body, Controller, Get, Param, Post, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { PlanUpgradeRequestsService } from './plan-upgrade-requests.service';
import { CreatePlanUpgradeRequestDto, SubmitUpgradeProofDto, ReviewPlanUpgradeDto } from './dto/plan-upgrade.dto';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('subscriptions/upgrade-requests')
export class PlanUpgradeRequestsController {
  constructor(private readonly planUpgradeRequestsService: PlanUpgradeRequestsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreatePlanUpgradeRequestDto) {
    if (!user.companyId) {
      throw new BadRequestException('Acción solo disponible para empresas activas.');
    }
    return this.planUpgradeRequestsService.createRequest(user.companyId, body);
  }

  @Post(':id/proof')
  submitProof(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SubmitUpgradeProofDto,
  ) {
    if (!user.companyId) {
      throw new BadRequestException('Acción solo disponible para empresas activas.');
    }
    return this.planUpgradeRequestsService.submitProof(id, user.companyId, body);
  }

  @Get('my')
  getMyRequests(@CurrentUser() user: AuthUser) {
    return this.planUpgradeRequestsService.getByCompany(user.companyId ?? '');
  }

  @Get('my/pending')
  getMyPendingRequest(@CurrentUser() user: AuthUser) {
    return this.planUpgradeRequestsService.getPendingRequest(user.companyId ?? '');
  }

  @Roles('SUPER_ADMIN')
  @Get('pending')
  getPending() {
    return this.planUpgradeRequestsService.getPending();
  }

  @Roles('SUPER_ADMIN')
  @Post(':id/review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ReviewPlanUpgradeDto,
  ) {
    return this.planUpgradeRequestsService.review(id, user.sub, body);
  }
}