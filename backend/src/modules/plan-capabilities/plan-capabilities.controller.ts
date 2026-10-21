import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import {
  CurrentUser,
  AuthUser,
} from "@/common/decorators/current-user.decorator";
import { PlanCapabilitiesService } from "./plan-capabilities.service";
import { ApiQuotaService } from "./api-quota.service";
import {
  PLAN_FEATURE_KEYS,
  PLAN_MODULE_KEYS,
} from "./plan-capabilities.constants";

@Controller("plan-capabilities")
@UseGuards(JwtAuthGuard)
export class PlanCapabilitiesController {
  constructor(
    private readonly planCapabilities: PlanCapabilitiesService,
    private readonly apiQuota: ApiQuotaService,
  ) {}

  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    const isGlobalAdmin = user?.roles?.some((role) =>
      ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(role),
    );

    if (isGlobalAdmin || !user?.companyId) {
      return {
        planId: null,
        planCode: "GLOBAL_ADMIN",
        planName: "Administrador",
        modules: [...PLAN_MODULE_KEYS],
        features: [...PLAN_FEATURE_KEYS],
        apiEnabled: true,
        apiSearchDniEnabled: true,
        apiQuota: 0,
        maxUsers: Number.MAX_SAFE_INTEGER,
        maxProducts: Number.MAX_SAFE_INTEGER,
        apiUsage: {
          allowed: true,
          used: 0,
          limit: 0,
          remaining: 0,
          period: "",
        },
      };
    }

    const capabilities = await this.planCapabilities.getCapabilities(
      user.companyId,
    );
    const apiUsage = await this.apiQuota.getUsage(user.companyId);

    return { ...capabilities, apiUsage };
  }
}
