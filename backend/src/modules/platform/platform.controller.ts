import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaymentSettingsService } from '@/modules/payments/payment-settings.service';
import {
  ReviewPaymentProofDto,
  UpdatePaymentSettingsDto,
} from '@/modules/payments/dto/payment-settings.dto';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformGuard)
export class PlatformController {
  constructor(private readonly paymentSettings: PaymentSettingsService) {}

  @Get('context')
  getContext(@CurrentUser() user: AuthUser) {
    return {
      platform: true,
      globalRole: user.roles.find((role) =>
        ['SUPER_ADMIN', 'SUPPORT_ADMIN'].includes(role),
      ),
      roles: user.roles,
    };
  }

  @Get('settings/payment')
  listPaymentSettings() {
    return this.paymentSettings.getAllSettings();
  }

  @Patch('settings/payment/:provider')
  updatePaymentSettings(
    @Param('provider', new ParseEnumPipe(PaymentProvider)) provider: PaymentProvider,
    @Body() data: UpdatePaymentSettingsDto,
  ) {
    return this.paymentSettings.updateSettings(provider, data);
  }

  @Get('settings/payment/proofs/pending')
  getPendingProofs() {
    return this.paymentSettings.getPendingProofs();
  }

  @Patch('settings/payment/proofs/:proofId/review')
  reviewProof(
    @Param('proofId') proofId: string,
    @Query('userId') userId: string,
    @Body() data: ReviewPaymentProofDto,
  ) {
    return this.paymentSettings.reviewProof(proofId, userId, data);
  }
}
