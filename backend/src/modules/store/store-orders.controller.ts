import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { StoreAccess } from "@/common/decorators/store-access.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { PrismaService } from "@/database/prisma/prisma.service";
import { StoreActor } from "./store.strategy";
import { StoreOrdersService } from "./store-orders.service";
import { StorePaymentsService } from "./store-payments.service";
import { StoreCryptoService } from "./store-crypto.service";
import {
  StoreCreateOrderDto,
  StoreIntegrationDto,
  StoreOrderActionDto,
  StoreProofDto,
  StoreReasonDto,
  StoreRefundDto,
} from "./dto/store-order.dto";
import { StoreCatalogQuery } from "./dto/store.dto";
import { StoreCloseoutGuard } from "./store-closeout.guard";
import { StorePrivateInterceptor } from "./store-private.interceptor";

type ClientRequest = Request & { user: StoreActor };
type StaffRequest = Request & { tenantId: string; user: { sub: string } };

@StoreAccess()
@UseInterceptors(StorePrivateInterceptor)
@Controller("store/:slug")
export class StoreOrdersController {
  constructor(
    private readonly orders: StoreOrdersService,
    private readonly payments: StorePaymentsService,
    private readonly prisma: PrismaService,
  ) {}
  @Get("orders") list(
    @Req() req: ClientRequest,
    @Query() query: StoreCatalogQuery,
  ) {
    return this.orders.list(req.user.companyId, query.page, req.user.accountId);
  }
  @Get("orders/:id") get(@Req() req: ClientRequest, @Param("id") id: string) {
    return this.orders.get(req.user.companyId, id, req.user.accountId);
  }
  @Throttle({ default: { limit: 8, ttl: 60000 } }) @Post("orders") create(
    @Param("slug") slug: string,
    @Req() req: ClientRequest,
    @Body() input: StoreCreateOrderDto,
  ) {
    return this.orders.create(slug, req.user, input);
  }
  @Post("orders/:id/cancel") cancel(
    @Req() req: ClientRequest,
    @Param("id") id: string,
  ) {
    return this.orders.cancel(
      req.user.companyId,
      id,
      req.user.sub,
      req.user.accountId,
    );
  }
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("orders/:id/payment-proofs")
  proof(
    @Req() req: ClientRequest,
    @Param("id") id: string,
    @Body() input: StoreProofDto,
  ) {
    return this.orders.proof(req.user, id, input.image);
  }
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post("orders/:id/payments")
  payment(@Req() req: ClientRequest, @Param("id") id: string) {
    return this.payments.start(req.user, id);
  }
  @Post("orders/:id/refund-request") refund(
    @Req() req: ClientRequest,
    @Param("id") id: string,
    @Body() input: StoreReasonDto,
  ) {
    return this.orders.requestRefund(req.user, id, input.reason);
  }
  @Get("me/notifications") notifications(@Req() req: ClientRequest) {
    return this.prisma.storeNotification.findMany({
      where: { companyId: req.user.companyId, accountId: req.user.accountId },
      select: {
        id: true,
        orderId: true,
        message: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
  @Post("me/notifications/read") async read(@Req() req: ClientRequest) {
    await this.prisma.storeNotification.updateMany({
      where: {
        companyId: req.user.companyId,
        accountId: req.user.accountId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { read: true };
  }
}

@Roles("COMPANY_ADMIN")
@UseInterceptors(StorePrivateInterceptor)
@UseGuards(StoreCloseoutGuard, PermissionsGuard)
@Permissions(Permission.STORE_MANAGE)
@Controller("store-admin")
export class StoreOrdersAdminController {
  constructor(
    private readonly orders: StoreOrdersService,
    private readonly payments: StorePaymentsService,
    private readonly prisma: PrismaService,
    private readonly crypto: StoreCryptoService,
  ) {}
  @Get("orders") list(
    @Req() req: StaffRequest,
    @Query() query: StoreCatalogQuery,
  ) {
    return this.orders.list(req.tenantId, query.page);
  }
  @Get("orders/:id") get(@Req() req: StaffRequest, @Param("id") id: string) {
    return this.orders.get(req.tenantId, id);
  }
  @Patch("orders/:id") action(
    @Req() req: StaffRequest,
    @Param("id") id: string,
    @Body() input: StoreOrderActionDto,
  ) {
    return this.orders.action(req.tenantId, id, input, req.user.sub);
  }
  @Post("orders/:id/refund") refund(
    @Req() req: StaffRequest,
    @Param("id") id: string,
    @Body() input: StoreRefundDto,
  ) {
    return this.payments.refund(
      req.tenantId,
      id,
      input.reference,
      req.user.sub,
    );
  }
  @Get("proofs/:id") async proof(
    @Req() req: StaffRequest,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const proof = await this.prisma.storePaymentProof.findFirst({
      where: { id, companyId: req.tenantId },
    });
    if (!proof) throw new NotFoundException();
    res.setHeader("Cache-Control", "no-store");
    return { image: this.crypto.decrypt(proof.encryptedImage) };
  }
  @Get("integration") integration(@Req() req: StaffRequest) {
    return this.payments.integration(req.tenantId);
  }
  @UseGuards(TenantGuard) @Post("integration") configure(
    @Req() req: StaffRequest,
    @Body() input: StoreIntegrationDto,
  ) {
    return this.payments.configure(req.tenantId, input);
  }
  @Get("payment-events") events(@Req() req: StaffRequest) {
    return this.prisma.storePaymentEvent.findMany({
      where: { companyId: req.tenantId, requiresReview: true },
      orderBy: { receivedAt: "desc" },
      take: 50,
    });
  }
}

@Controller("store-payments")
export class StoreWebhookController {
  constructor(private readonly payments: StorePaymentsService) {}
  @Public()
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Post("webhooks/:integration")
  webhook(@Param("integration") integration: string, @Req() req: Request) {
    return this.payments.webhook(
      integration,
      req.headers,
      req.query as Record<string, unknown>,
    );
  }
}
