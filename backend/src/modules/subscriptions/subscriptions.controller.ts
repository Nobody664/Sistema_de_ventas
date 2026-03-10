import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { SubscriptionsService } from './subscriptions.service';

@UseGuards(TenantGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('current')
  findCurrent(@Req() request: { tenantId: string }) {
    return this.subscriptionsService.findByCompany(request.tenantId);
  }
}

