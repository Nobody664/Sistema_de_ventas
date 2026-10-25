import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { RequireModule } from "@/modules/plan-capabilities/decorators/require-module.decorator";
import { RequireFeature } from "@/modules/plan-capabilities/decorators/require-feature.decorator";
import { ApiQuotaGuard } from "@/modules/plan-capabilities/guards/api-quota.guard";
import { DniService } from "./dni.service";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";

@Controller("dni")
@UseGuards(JwtAuthGuard, ApiQuotaGuard)
@RequireModule("api_search_dni")
@RequireFeature("api.dni_search")
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class DniController {
  constructor(private readonly dniService: DniService) {}

  @Roles("COMPANY_ADMIN", "MANAGER", "CASHIER")
  @Get(":dni")
  async findByDni(@Param("dni") dni: string, @CurrentUser() user: AuthUser) {
    return this.dniService.findByDni(dni, user.companyId ?? null);
  }

  @Roles("COMPANY_ADMIN", "MANAGER", "CASHIER")
  @Get("ruc/:ruc")
  async findByRuc(@Param("ruc") ruc: string, @CurrentUser() user: AuthUser) {
    return this.dniService.findByRuc(ruc, user.companyId ?? null);
  }
}
