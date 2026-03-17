import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { PaymentSettingsService } from './payment-settings.service';
import {
  UpdatePaymentSettingsDto,
  PaymentSettingsResponseDto,
  UploadPaymentProofDto,
  PaymentProofResponseDto,
  ReviewPaymentProofDto,
} from './dto/payment-settings.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { GlobalRole } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('payments/settings')
export class PaymentSettingsController {
  constructor(private readonly paymentSettingsService: PaymentSettingsService) {}

  @Public()
  @Get()
  async getAllSettingsRoot(): Promise<PaymentSettingsResponseDto[]> {
    return this.paymentSettingsService.getAllSettings();
  }

  @Public()
  @Get('test')
  async test(): Promise<{ message: string }> {
    return { message: 'Test works!' };
  }

  @Public()
  @Get('all')
  async getAllSettings(): Promise<PaymentSettingsResponseDto[]> {
    return this.paymentSettingsService.getAllSettings();
  }

  @Public()
  @Get('provider/:provider')
  async getSettingsByProvider(
    @Param('provider') provider: string,
  ): Promise<PaymentSettingsResponseDto | null> {
    const paymentProvider = provider.toUpperCase() as PaymentProvider;
    return this.paymentSettingsService.getSettingsByProvider(paymentProvider);
  }

  @Public()
  @Post('proof/:subscriptionId')
  async uploadProof(
    @Param('subscriptionId') subscriptionId: string,
    @Body() data: UploadPaymentProofDto,
  ): Promise<PaymentProofResponseDto> {
    return this.paymentSettingsService.uploadPaymentProof(subscriptionId, data);
  }

  @Public()
  @Get('proof/subscription/:subscriptionId')
  async getProofsBySubscription(
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<PaymentProofResponseDto[]> {
    return this.paymentSettingsService.getProofsBySubscription(subscriptionId);
  }

  @Public()
  @Post('test/:id')
  async testPublicEndpoint(@Param('id') id: string): Promise<{ message: string }> {
    return { message: 'Test works: ' + id };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN)
  @Patch('provider/:provider')
  async updateSettings(
    @Param('provider') provider: string,
    @Body() data: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsResponseDto> {
    const paymentProvider = provider.toUpperCase() as PaymentProvider;
    return this.paymentSettingsService.updateSettings(paymentProvider, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN)
  @Get('proof/pending')
  async getPendingProofs(): Promise<PaymentProofResponseDto[]> {
    return this.paymentSettingsService.getPendingProofs();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN)
  @Patch('proof/:proofId/review')
  async reviewProof(
    @Param('proofId') proofId: string,
    @CurrentUser() user: { id: string },
    @Body() data: ReviewPaymentProofDto,
  ): Promise<PaymentProofResponseDto> {
    return this.paymentSettingsService.reviewProof(proofId, user.id, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('proof/:proofId')
  async getProofById(
    @Param('proofId') proofId: string,
  ): Promise<PaymentProofResponseDto> {
    return this.paymentSettingsService.getProofById(proofId);
  }
}
