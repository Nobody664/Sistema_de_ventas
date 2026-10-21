import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { AuditAction, PaymentProvider } from "@prisma/client";

import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { PaymentSettingsService } from "@/modules/payments/payment-settings.service";
import {
  ReviewPaymentProofDto,
  UpdatePaymentSettingsDto,
} from "@/modules/payments/dto/payment-settings.dto";
import { PlatformAuditService } from "./platform-audit.service";

@Controller("platform")
@Roles("SUPER_ADMIN", "SUPPORT_ADMIN")
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformController {
  constructor(
    private readonly paymentSettings: PaymentSettingsService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  @Permissions(Permission.PLATFORM_VIEW)
  @Get("context")
  getContext(@CurrentUser() user: AuthUser) {
    return {
      platform: true,
      globalRole: user.roles.find((role) =>
        ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(role),
      ),
      roles: user.roles,
    };
  }

  @Permissions(Permission.PLATFORM_VIEW)
  @Get("settings/payment")
  listPaymentSettings() {
    return this.paymentSettings.getAllSettings();
  }

  @Roles("SUPER_ADMIN")
  @Permissions(Permission.PLATFORM_MANAGE_SETTINGS)
  @Patch("settings/payment/:provider")
  async updatePaymentSettings(
    @Param("provider", new ParseEnumPipe(PaymentProvider))
    provider: PaymentProvider,
    @Body() data: UpdatePaymentSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.paymentSettings.updateSettings(provider, data);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "PaymentSetting",
      entityId: result.id,
      changes: { provider, isEnabled: data.isEnabled },
    });
    return result;
  }

  @Roles("SUPER_ADMIN")
  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Get("settings/payment/proofs/pending")
  getPendingProofs() {
    return this.paymentSettings.getPendingProofs();
  }

  @Roles("SUPER_ADMIN")
  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Patch("settings/payment/proofs/:proofId/review")
  async reviewProof(
    @Param("proofId") proofId: string,
    @Body() data: ReviewPaymentProofDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.paymentSettings.reviewProof(
      proofId,
      user.sub,
      data,
    );
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "PaymentProof",
      entityId: proofId,
      changes: { status: data.status, notes: data.notes },
    });
    return result;
  }
}
