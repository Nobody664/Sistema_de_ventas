import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import { Request } from "express";
import { Public } from "@/common/decorators/public.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { PaymentsService } from "./payments.service";
import { UploadPaymentImageDto } from "./dto/payment-settings.dto";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Permission } from "@/common/constants/permissions.constant";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { ConfirmSubscriptionPaymentDto } from "./dto/confirm-subscription-payment.dto";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get()
  findAll(@Req() request: { tenantId: string }) {
    return this.paymentsService.findByCompany(request.tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get("pending")
  findPending(@Req() request: { tenantId: string }) {
    return this.paymentsService.findPendingByCompany(request.tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get("history")
  getHistory(
    @Req() request: { tenantId: string },
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.paymentsService.getPaymentHistory(
      request.tenantId,
      page,
      limit,
    );
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get("current-pending")
  getCurrentPending(@Req() request: { tenantId: string }) {
    return this.paymentsService.getCurrentPending(request.tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post(":id/proof")
  uploadProof(
    @Param("id") id: string,
    @Req() request: { tenantId: string },
    @Body() body: UploadPaymentImageDto,
  ) {
    return this.paymentsService.uploadProofForPayment(
      id,
      request.tenantId,
      body.imageBase64,
      body.paymentDate,
    );
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get(":id")
  findOne(@Param("id") id: string, @Req() request: { tenantId: string }) {
    return this.paymentsService.findOne(id, request.tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get(":id/receipt")
  getReceipt(@Param("id") id: string, @Req() request: { tenantId: string }) {
    return this.paymentsService.generateReceipt(id, request.tenantId);
  }

  @Roles("SUPER_ADMIN")
  @Permissions(Permission.PLATFORM_FINANCE_MANAGE)
  @UseGuards(JwtAuthGuard, PlatformGuard, RolesGuard, PermissionsGuard)
  @Patch(":id/mark-paid")
  markAsPaid(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ConfirmSubscriptionPaymentDto,
  ) {
    return this.paymentsService.markAsPaid(id, user, body);
  }

  @Roles("SUPER_ADMIN")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("admin/pending")
  findAllPending(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.paymentsService.findAllPending(page, limit);
  }

  @Roles("SUPER_ADMIN")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("admin/stats")
  getStats() {
    return this.paymentsService.getStats();
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post("checkout-session/:provider")
  createCheckoutSession(
    @Param("provider") provider: string,
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
  @Post("webhooks/:provider")
  async handleWebhook(
    @Param("provider") provider: string,
    @Body() payload: unknown,
    @Req() req: Request,
  ) {
    return this.paymentsService.handleWebhook(
      provider,
      payload,
      req.headers,
      req.query as Record<string, unknown>,
    );
  }
}
