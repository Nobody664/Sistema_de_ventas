import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PlatformGuard } from '@/common/guards/platform.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CheckoutRequestsService } from '@/modules/payments/checkout-requests.service';
import { ReviewCheckoutRequestDto } from '@/modules/payments/dto/checkout-requests.dto';

@Controller('platform/checkout-requests')
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformCheckoutRequestsController {
  constructor(private readonly checkoutRequestsService: CheckoutRequestsService) {}

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Get('pending')
  getPending() {
    return this.checkoutRequestsService.getPending();
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Patch(':requestId/review')
  review(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ReviewCheckoutRequestDto,
  ) {
    return this.checkoutRequestsService.review(requestId, user.sub, body);
  }
}
