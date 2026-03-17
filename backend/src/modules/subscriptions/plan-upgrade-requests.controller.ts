import { Body, Controller, Get, Param, Post, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { PlanUpgradeRequestsService } from './plan-upgrade-requests.service';
import { CreatePlanUpgradeRequestDto, SubmitUpgradeProofDto, ReviewPlanUpgradeDto } from './dto/plan-upgrade.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('subscriptions/upgrade-requests')
@UseGuards(JwtAuthGuard)
export class PlanUpgradeRequestsController {
  constructor(private readonly planUpgradeRequestsService: PlanUpgradeRequestsService) {}

  @Post()
  create(@Request() req: { tenantId: string }, @Body() body: CreatePlanUpgradeRequestDto) {
    return this.planUpgradeRequestsService.createRequest(req.tenantId, body);
  }

  @Post(':id/proof')
  submitProof(@Param('id', ParseUUIDPipe) id: string, @Body() body: SubmitUpgradeProofDto) {
    return this.planUpgradeRequestsService.submitProof(id, body);
  }

  @Get('my')
  getMyRequests(@Request() req: { tenantId: string }) {
    return this.planUpgradeRequestsService.getByCompany(req.tenantId);
  }

  @Get('my/pending')
  getMyPendingRequest(@Request() req: { tenantId: string }) {
    return this.planUpgradeRequestsService.getPendingRequest(req.tenantId);
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
    @Request() req: { user: { id: string } },
    @Body() body: ReviewPlanUpgradeDto,
  ) {
    return this.planUpgradeRequestsService.review(id, req.user.id, body);
  }
}
