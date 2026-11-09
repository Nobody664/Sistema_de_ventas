import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
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
import { Public } from "@/common/decorators/public.decorator";
import { StoreAccess } from "@/common/decorators/store-access.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { StoreManagementGuard } from "./admin/store-management.guard";
import { StoreAdminManagementService } from "./admin/store-admin-management.service";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Permission } from "@/common/constants/permissions.constant";
import { PrismaService } from "@/database/prisma/prisma.service";
import { StoreActor } from "./store.strategy";
import { StoreAuthService } from "./store-auth.service";
import { StoreService } from "./store.service";
import {
  StoreAccountStatusDto,
  StoreAddressDto,
  StoreCatalogQuery,
  StoreEmailDto,
  StoreLoginDto,
  StoreProfileDto,
  StorePublishDto,
  StoreRegisterDto,
  StoreResetDto,
  StoreSettingsDto,
  StoreTokenDto,
} from "./dto/store.dto";

import { StoreCartService } from "./store-cart.service";
import { StoreMethodsService } from "./store-methods.service";
import { StorePrivateInterceptor } from "./store-private.interceptor";
import { StoreIdentifierPipe } from "./store-identifier.pipe";
import {
  StoreCartItemDto,
  StoreCommerceSettingsDto,
  StorePaymentMethodDto,
  StoreQuoteDto,
  StoreShippingMethodDto,
} from "./dto/store-commerce.dto";

type StoreRequest = Request & { user: StoreActor };

@StoreAccess()
@UseInterceptors(StorePrivateInterceptor)
@Controller("store/:slug")
export class StoreController {
  constructor(
    private readonly auth: StoreAuthService,
    private readonly store: StoreService,
    private readonly prisma: PrismaService,
    private readonly cartService: StoreCartService,
    private readonly methodsService: StoreMethodsService,
  ) {}
  private cookies(
    res: Response,
    session: { accessToken: string; refreshToken: string },
  ) {
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    res.cookie("store_access_token", session.accessToken, {
      ...options,
      maxAge: 900000,
    });
    res.cookie("store_refresh_token", session.refreshToken, {
      ...options,
      maxAge: 30 * 86400000,
    });
  }
  @Public() @Get("info") info(@Param("slug") slug: string) {
    return this.store.info(slug);
  }
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("auth/register")
  register(@Param("slug") slug: string, @Body() input: StoreRegisterDto) {
    return this.auth.register(slug, input);
  }
  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post("auth/login")
  async login(
    @Param("slug") slug: string,
    @Body() input: StoreLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.cookies(res, await this.auth.login(slug, input));
    return { role: "USUARIO_CLIENTE_FINAL" };
  }
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post("auth/refresh")
  async refresh(
    @Param("slug") slug: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.cookies(
      res,
      await this.auth.refresh(slug, req.cookies?.store_refresh_token),
    );
    return { refreshed: true };
  }
  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post("auth/resend")
  resend(@Param("slug") slug: string, @Body() input: StoreEmailDto) {
    return this.auth.sendAction(slug, input.email, "VERIFY");
  }
  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post("auth/forgot-password")
  forgot(@Param("slug") slug: string, @Body() input: StoreEmailDto) {
    return this.auth.sendAction(slug, input.email, "RESET");
  }
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("auth/verify")
  verify(@Param("slug") slug: string, @Body() input: StoreTokenDto) {
    return this.auth.verify(slug, input.token);
  }
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("auth/reset-password")
  reset(@Param("slug") slug: string, @Body() input: StoreResetDto) {
    return this.auth.resetPassword(slug, input);
  }
  @Post("auth/logout") async logout(
    @Req() req: StoreRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.prisma.storeSession.updateMany({
      where: { id: req.user.sid, accountId: req.user.accountId },
      data: { revokedAt: new Date() },
    });
    res.clearCookie("store_access_token", { path: "/" });
    res.clearCookie("store_refresh_token", { path: "/" });
    return { message: "Sesión cerrada" };
  }
  @Get("me") me(@Req() req: StoreRequest) {
    return this.auth.me(req.user);
  }
  @Patch("me") profile(
    @Req() req: StoreRequest,
    @Body() input: StoreProfileDto,
  ) {
    return this.auth.profile(req.user, input);
  }
  @Post("me/addresses") address(
    @Req() req: StoreRequest,
    @Body() input: StoreAddressDto,
  ) {
    return this.auth.address(req.user, input);
  }
  @Patch("me/addresses/:id") updateAddress(
    @Req() req: StoreRequest,
    @Param("id", StoreIdentifierPipe) id: string,
    @Body() input: StoreAddressDto,
  ) {
    return this.auth.address(req.user, input, id);
  }
  @Delete("me/addresses/:id") async deleteAddress(
    @Req() req: StoreRequest,
    @Param("id", StoreIdentifierPipe) id: string,
  ) {
    await this.prisma.customerAddress.deleteMany({
      where: {
        id,
        companyId: req.user.companyId,
        accountId: req.user.accountId,
      },
    });
    return this.auth.me(req.user);
  }
  @Post("me/close") async close(@Req() req: StoreRequest) {
    if (
      await this.prisma.storeOrder.count({
        where: {
          accountId: req.user.accountId,
          status: { notIn: ["CANCELLED", "EXPIRED", "COMPLETED"] },
        },
      })
    )
      throw new ConflictException(
        "Resuelve tus pedidos pendientes antes de cerrar la cuenta",
      );
    await this.prisma.customerAccount.updateMany({
      where: { id: req.user.accountId, companyId: req.user.companyId },
      data: { status: "CLOSED" },
    });
    await this.prisma.storeSession.updateMany({
      where: { accountId: req.user.accountId },
      data: { revokedAt: new Date() },
    });
    return {
      message:
        "Cuenta comercial cerrada. Conservamos los pedidos necesarios para atender tus operaciones.",
    };
  }
  @Get("methods") methods(@Req() req: StoreRequest) {
    return this.methodsService.list(req.user.companyId);
  }
  @Get("cart") cart(@Req() req: StoreRequest) {
    return this.cartService.cart(req.user);
  }
  @Post("cart/items") changeCart(
    @Param("slug") slug: string,
    @Req() req: StoreRequest,
    @Body() input: StoreCartItemDto,
  ) {
    return this.cartService.change(slug, req.user, input);
  }
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post("checkout/quote")
  quote(
    @Param("slug") slug: string,
    @Req() req: StoreRequest,
    @Body() input: StoreQuoteDto,
  ) {
    return this.cartService.quote(slug, req.user, input);
  }
  @Get("categories") categories(@Param("slug") slug: string) {
    return this.store.categories(slug);
  }
  @Get("catalog/:id") detail(
    @Param("slug") slug: string,
    @Param("id", StoreIdentifierPipe) id: string,
  ) {
    return this.store.detail(slug, id);
  }
  @Get("catalog") catalog(
    @Param("slug") slug: string,
    @Query() query: StoreCatalogQuery,
  ) {
    return this.store.catalog(slug, query);
  }
}

@Roles("COMPANY_ADMIN")
@UseInterceptors(StorePrivateInterceptor)
@UseGuards(StoreManagementGuard, PermissionsGuard)
@Permissions(Permission.STORE_MANAGE)
@Controller("store-admin")
export class StoreAdminController {
  constructor(
    private readonly store: StoreService,
    private readonly prisma: PrismaService,
    private readonly methodsService: StoreMethodsService,
    private readonly management: StoreAdminManagementService,
  ) {}
  @Get("methods") methods(@Req() req: { tenantId: string }) {
    return this.methodsService.list(req.tenantId, true);
  }
  @Patch("commerce") commerce(
    @Req() req: { tenantId: string },
    @Body() input: StoreCommerceSettingsDto,
  ) {
    return this.methodsService.settings(req.tenantId, input);
  }
  @Post("payment-methods") payment(
    @Req() req: { tenantId: string },
    @Body() input: StorePaymentMethodDto,
  ) {
    return this.methodsService.payment(req.tenantId, input);
  }
  @Post("shipping-methods") shipping(
    @Req() req: { tenantId: string },
    @Body() input: StoreShippingMethodDto,
  ) {
    return this.methodsService.shipping(req.tenantId, input);
  }
  @Patch("shipping-methods/:id") updateShipping(
    @Req() req: { tenantId: string },
    @Param("id") id: string,
    @Body() input: StoreShippingMethodDto,
  ) {
    return this.methodsService.shipping(req.tenantId, input, id);
  }
  @Get("settings") settings(@Req() req: { tenantId: string }) {
    return this.store.settings(req.tenantId);
  }
  @Patch("settings") update(
    @Req() req: { tenantId: string },
    @Body() input: StoreSettingsDto,
  ) {
    return this.store.updateSettings(req.tenantId, input);
  }
  @Get("products") products(
    @Req() req: { tenantId: string },
    @Query() query: StoreCatalogQuery,
  ) {
    return this.prisma.product.findMany({
      where: {
        companyId: req.tenantId,
        deletedAt: null,
        ...(query.search
          ? { name: { contains: query.search, mode: "insensitive" } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        storeVisible: true,
        salePrice: true,
        isActive: true,
      },
      orderBy: { id: "asc" },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
    });
  }
  @Patch("products/:id") async publish(
    @Req() req: { tenantId: string },
    @Param("id") id: string,
    @Body() input: StorePublishDto,
  ) {
    const result = await this.prisma.product.updateMany({
      where: { id, companyId: req.tenantId, deletedAt: null },
      data: { storeVisible: input.visible },
    });
    return { updated: result.count === 1 };
  }
  @Get("customers") customers(
    @Req() req: { tenantId: string },
    @Query() query: StoreCatalogQuery,
  ) {
    return this.prisma.customerAccount.findMany({
      where: { companyId: req.tenantId },
      select: {
        id: true,
        status: true,
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: { id: "asc" },
    });
  }
  @Patch("customers/:id") async suspend(
    @Req() req: { tenantId: string },
    @Param("id") id: string,
    @Body() input: StoreAccountStatusDto,
  ) {
    return this.management.suspendAccount(req.tenantId, id, input.suspended);
  }
}
