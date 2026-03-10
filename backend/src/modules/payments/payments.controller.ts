import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(TenantGuard)
  @Post('checkout/:provider')
  createCheckoutSession(
    @Param('provider') provider: string,
    @Body() body: { planCode: string },
    @Req() request: { tenantId: string },
  ) {
    return this.paymentsService.createCheckoutSession({
      companyId: request.tenantId,
      planCode: body.planCode,
      provider,
    });
  }

  @Public()
  @Post('webhooks/:provider')
  handleWebhook(@Param('provider') provider: string, @Body() payload: unknown) {
    return this.paymentsService.handleWebhook(provider, payload);
  }
}

