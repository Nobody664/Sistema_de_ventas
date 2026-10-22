import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import {
  CurrentUser,
  AuthUser,
} from "@/common/decorators/current-user.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { RequireModule } from "@/modules/plan-capabilities/decorators/require-module.decorator";
import { CreateStockExitDto } from "./dto/stock-exit.dto";
import { StockExitsService } from "./stock-exits.service";

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequireModule("distributors")
@Controller("stock-exits")
export class StockExitsController {
  constructor(private readonly stockExitsService: StockExitsService) {}

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_VIEW)
  @Get()
  findAll(@Req() request: { tenantId: string }) {
    return this.stockExitsService.findAll(request.tenantId);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_TRANSFER)
  @Post()
  create(
    @Req() request: { tenantId: string },
    @CurrentUser() user: AuthUser,
    @Body() body: CreateStockExitDto,
  ) {
    return this.stockExitsService.create(
      request.tenantId,
      user?.sub ?? null,
      body,
    );
  }
}
