import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { PaymentSettingsService } from './payment-settings.service';
import {
  UpdatePaymentSettingsDto,
  PaymentSettingsResponseDto,
  PaymentSettingsPublicResponseDto,
  UploadPaymentProofDto,
  PaymentProofResponseDto,
  ReviewPaymentProofDto,
} from './dto/payment-settings.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { GlobalRole } from '@prisma/client';

@Controller('payment-settings')
export class PaymentSettingsController {
  constructor(private readonly paymentSettingsService: PaymentSettingsService) {}

  @Public()
  @Get()
  async getAllSettings(): Promise<PaymentSettingsPublicResponseDto[]> {
    return this.paymentSettingsService.getPublicSettings();
  }

  @Public()
  @Get('provider/:provider')
  async getSettingsByProvider(
    @Param('provider', new ParseEnumPipe(PaymentProvider)) provider: PaymentProvider,
  ): Promise<PaymentSettingsPublicResponseDto | null> {
    return this.paymentSettingsService.getPublicSettingByProvider(provider);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN)
  @Patch('provider/:provider')
  async updateSettings(
    @Param('provider', new ParseEnumPipe(PaymentProvider)) provider: PaymentProvider,
    @Body() data: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsResponseDto> {
    return this.paymentSettingsService.updateSettings(provider, data);
  }

  @Post('proof/:subscriptionId')
  async uploadProof(
    @CurrentUser() user: AuthUser,
    @Param('subscriptionId') subscriptionId: string,
    @Body() data: UploadPaymentProofDto,
  ): Promise<PaymentProofResponseDto> {
    if (!user.companyId) {
      throw new ForbiddenException('Tenant context is required for this resource.');
    }
    return this.paymentSettingsService.uploadPaymentProof(
      subscriptionId,
      data,
      user.companyId,
    );
  }

  @Get('proof/subscription/:subscriptionId')
  async getProofsBySubscription(
    @CurrentUser() user: AuthUser,
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<PaymentProofResponseDto[]> {
    if (!user.companyId) {
      throw new ForbiddenException('Tenant context is required for this resource.');
    }
    return this.paymentSettingsService.getProofsBySubscription(
      subscriptionId,
      user.companyId,
    );
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
    @Query('userId') userId: string,
    @Body() data: ReviewPaymentProofDto,
  ): Promise<PaymentProofResponseDto> {
    return this.paymentSettingsService.reviewProof(proofId, userId, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('proof/:proofId')
  async getProofById(
    @CurrentUser() user: AuthUser,
    @Param('proofId') proofId: string,
  ): Promise<PaymentProofResponseDto> {
    const isGlobalAdmin =
      user.roles.includes(GlobalRole.SUPER_ADMIN) ||
      user.roles.includes(GlobalRole.SUPPORT_ADMIN);
    if (!isGlobalAdmin && !user.companyId) {
      throw new NotFoundException(`Comprobante #${proofId} no encontrado`);
    }
    return this.paymentSettingsService.getProofById(
      proofId,
      isGlobalAdmin ? undefined : (user.companyId ?? undefined),
    );
  }
}
