import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Query,
  Logger,
  Param,
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
import {
  CancelSaleDto,
  CreateSaleDto,
  ExportSalesQueryDto,
  QuerySalesDto,
} from "./dto/sale.dto";
import { SalesService } from "./sales.service";

@Controller("sales")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequireModule("sales")
export class SalesController {
  private readonly logger = new Logger(SalesController.name);

  constructor(private readonly salesService: SalesService) {}

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SALE_EXPORT)
  @Get("export")
  exportSales(
    @Req() request: { tenantId: string },
    @Query() query: ExportSalesQueryDto,
  ) {
    return this.salesService.exportSales(request.tenantId, query);
  }

  @Roles("COMPANY_ADMIN", "MANAGER", "CASHIER")
  @Permissions(Permission.SALE_VIEW_DETAIL)
  @Get(":id")
  findById(
    @Req() request: { tenantId: string },
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.findById(request.tenantId, id, {
      userId: user.sub,
      roles: user.roles,
    });
  }

  @Roles("COMPANY_ADMIN", "MANAGER", "CASHIER")
  @Permissions(Permission.SALE_LIST)
  @Get()
  async findRecentSales(
    @Req() request: { tenantId: string },
    @Query() query: QuerySalesDto,
    @CurrentUser() user: AuthUser,
  ) {
    try {
      this.logger.log(
        `[SalesController] Fetching sales for tenant: ${request.tenantId}`,
      );
      const sales = await this.salesService.findRecentSales(
        request.tenantId,
        query,
        { userId: user.sub, roles: user.roles },
      );
      this.logger.log(`[SalesController] Found ${sales.length} sales`);
      return sales;
    } catch (error) {
      this.logger.error("[SalesController] Error fetching sales:", error);
      throw error;
    }
  }

  @Roles("COMPANY_ADMIN", "MANAGER", "CASHIER")
  @Permissions(Permission.SALE_CREATE)
  @Post()
  createSale(
    @Req() request: { tenantId: string },
    @Body() body: CreateSaleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.createSale(request.tenantId, body, user.sub);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SALE_CANCEL)
  @Post(":id/cancel")
  cancelSale(
    @Req() request: { tenantId: string },
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CancelSaleDto,
  ) {
    return this.salesService.cancelSale(
      request.tenantId,
      id,
      user?.sub,
      body?.reason,
    );
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SALE_CANCEL)
  @Post(":id/refund")
  refundSale(
    @Req() request: { tenantId: string },
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CancelSaleDto,
  ) {
    return this.salesService.refundSale(
      request.tenantId,
      id,
      user?.sub,
      body?.reason,
    );
  }
}
