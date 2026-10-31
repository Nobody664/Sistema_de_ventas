import {
  Body,
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
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { Public } from "@/common/decorators/public.decorator";
import { StoreAccess } from "@/common/decorators/store-access.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { TenantGuard } from "@/common/guards/tenant.guard";
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

type StoreRequest = Request & { user: StoreActor };

@StoreAccess()
@Controller("store/:slug")
export class StoreController {
  constructor(
    private readonly auth: StoreAuthService,
    private readonly store: StoreService,
    private readonly prisma: PrismaService,
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
    @Param("id") id: string,
    @Body() input: StoreAddressDto,
  ) {
    return this.auth.address(req.user, input, id);
  }
  @Delete("me/addresses/:id") async deleteAddress(
    @Req() req: StoreRequest,
    @Param("id") id: string,
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
  @Get("catalog") catalog(
    @Param("slug") slug: string,
    @Query() query: StoreCatalogQuery,
  ) {
    return this.store.catalog(slug, query);
  }
}

@Roles("COMPANY_ADMIN")
@UseGuards(TenantGuard, PermissionsGuard)
@Permissions(Permission.STORE_MANAGE)
@Controller("store-admin")
export class StoreAdminController {
  constructor(
    private readonly store: StoreService,
    private readonly prisma: PrismaService,
  ) {}
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
    const result = await this.prisma.customerAccount.updateMany({
      where: {
        id,
        companyId: req.tenantId,
        verifiedAt: { not: null },
        status: { not: "CLOSED" },
      },
      data: { status: input.suspended ? "SUSPENDED" : "ACTIVE" },
    });
    if (input.suspended)
      await this.prisma.storeSession.updateMany({
        where: { companyId: req.tenantId, accountId: id },
        data: { revokedAt: new Date() },
      });
    return { updated: result.count === 1 };
  }
}
