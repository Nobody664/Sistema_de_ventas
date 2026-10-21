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
  UseGuards,
} from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  CurrentUser,
  AuthUser,
} from "@/common/decorators/current-user.decorator";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { RequireModule } from "@/modules/plan-capabilities/decorators/require-module.decorator";
import { RequireFeature } from "@/modules/plan-capabilities/decorators/require-feature.decorator";
import {
  CreateDiscountCouponDto,
  QueryDiscountCouponDto,
  UpdateDiscountCouponDto,
  ValidateDiscountCouponDto,
} from "./dto/discount.dto";
import { DiscountsService } from "./discounts.service";

@Controller("discounts")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequireModule("sales")
@RequireFeature("sales.discounts")
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISCOUNT_LIST)
  @Get()
  findAll(
    @Req() request: { tenantId: string },
    @Query() query: QueryDiscountCouponDto,
  ) {
    return this.discountsService.findAll(request.tenantId, query);
  }

  @Roles("COMPANY_ADMIN", "MANAGER", "CASHIER")
  @Permissions(Permission.DISCOUNT_LIST)
  @Post("validate")
  validate(
    @Req() request: { tenantId: string },
    @Body() body: ValidateDiscountCouponDto,
  ) {
    return this.discountsService.validate(
      request.tenantId,
      body.code,
      body.subtotal,
    );
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISCOUNT_LIST)
  @Get(":id")
  findOne(@Req() request: { tenantId: string }, @Param("id") id: string) {
    return this.discountsService.findOne(request.tenantId, id);
  }

  @Roles("COMPANY_ADMIN")
  @Permissions(Permission.DISCOUNT_MANAGE)
  @Post()
  create(
    @Req() request: { tenantId: string },
    @CurrentUser() user: AuthUser,
    @Body() body: CreateDiscountCouponDto,
  ) {
    return this.discountsService.create(request.tenantId, user?.sub, body);
  }

  @Roles("COMPANY_ADMIN")
  @Permissions(Permission.DISCOUNT_MANAGE)
  @Patch(":id")
  update(
    @Req() request: { tenantId: string },
    @Param("id") id: string,
    @Body() body: UpdateDiscountCouponDto,
  ) {
    return this.discountsService.update(request.tenantId, id, body);
  }

  @Roles("COMPANY_ADMIN")
  @Permissions(Permission.DISCOUNT_MANAGE)
  @Delete(":id")
  remove(@Req() request: { tenantId: string }, @Param("id") id: string) {
    return this.discountsService.remove(request.tenantId, id);
  }
}
