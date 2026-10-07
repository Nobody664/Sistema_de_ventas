import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { GlobalRole } from '@prisma/client';
import { CheckoutRequestsService } from './checkout-requests.service';
import {
  CreateCheckoutRequestDto,
  ReviewCheckoutRequestDto,
  SubmitCheckoutProofDto,
} from './dto/checkout-requests.dto';

@Controller('payments/checkout')
export class CheckoutRequestsController {
  constructor(private readonly checkoutRequestsService: CheckoutRequestsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('requests')
  create(
    @CurrentUser() user: AuthUser | null,
    @Body() body: CreateCheckoutRequestDto,
  ) {
    if (body.companyId && !user?.companyId) {
      throw new UnauthorizedException('Sesion invalida para realizar esta operacion.');
    }

    return this.checkoutRequestsService.createRequest({
      planCode: body.planCode,
      paymentMethod: body.paymentMethod,
      companyId: user?.companyId ?? undefined,
      fullName: body.fullName,
      companyName: body.companyName,
      email: body.email,
      password: body.password,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('requests/:requestId/proof')
  submitProof(
    @CurrentUser() user: AuthUser | null,
    @Param('requestId') requestId: string,
    @Body() body: SubmitCheckoutProofDto,
  ) {
    return this.checkoutRequestsService.submitProof(
      requestId,
      user?.companyId ?? undefined,
      body,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN)
  @Get('requests/pending')
  getPending() {
    return this.checkoutRequestsService.getPending();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN)
  @Patch('requests/:requestId/review')
  review(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ReviewCheckoutRequestDto,
  ) {
    return this.checkoutRequestsService.review(requestId, user.sub, body);
  }
}
