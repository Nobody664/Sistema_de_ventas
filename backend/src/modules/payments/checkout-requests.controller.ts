import { Body, Controller, Get, Param, Patch, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { GlobalRole, PaymentProvider } from '@prisma/client';
import { CheckoutRequestsService } from './checkout-requests.service';
import { CreateCheckoutRequestDto, ReviewCheckoutRequestDto, SubmitCheckoutProofDto } from './dto/checkout-requests.dto';

@Controller('payments/checkout')
export class CheckoutRequestsController {
  constructor(private readonly checkoutRequestsService: CheckoutRequestsService) {}

  @Get('test')
  test() {
    return { message: 'Test endpoint works!' };
  }

  @Post('test')
  testPost() {
    return { message: 'Test POST works!' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests')
  create(@CurrentUser() user: { id: string; companyId: string }, @Body() body: any) {
    const paymentMethod = body.paymentMethod?.toUpperCase();
    if (!paymentMethod || !Object.values(PaymentProvider).includes(paymentMethod)) {
      throw new BadRequestException('Método de pago inválido');
    }
    
    return this.checkoutRequestsService.createRequest({
      planCode: body.planCode,
      paymentMethod: paymentMethod as PaymentProvider,
      companyId: user.companyId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests/:requestId/proof')
  submitProof(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('requestId') requestId: string,
    @Body() body: SubmitCheckoutProofDto,
  ) {
    return this.checkoutRequestsService.submitProof(requestId, user.companyId, body);
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
    @CurrentUser() user: { id: string },
    @Body() body: ReviewCheckoutRequestDto,
  ) {
    return this.checkoutRequestsService.review(requestId, user.id, body);
  }
}
