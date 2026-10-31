import { Controller, Get, Header, Param, Req, UseGuards } from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { RequireModule } from "@/modules/plan-capabilities/decorators/require-module.decorator";
import { ExpiryAlertsService } from "./expiry-alerts.service";

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequireModule("products")
@Controller("products")
export class ExpiryAlertsController {
  constructor(private readonly expiry: ExpiryAlertsService) {}

  @Roles("COMPANY_ADMIN", "MANAGER", "CASHIER")
  @Permissions(Permission.PRODUCT_LIST)
  @Get(":id/expiry")
  @Header("Cache-Control", "private, no-store")
  inspect(@Req() req: { tenantId: string }, @Param("id") id: string) {
    return this.expiry.inspectProduct(req.tenantId, id);
  }
}
