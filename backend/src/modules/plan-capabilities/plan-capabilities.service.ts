import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CacheService } from "@/cache/cache.service";
import {
  CORE_FEATURES,
  CORE_MODULES,
  FALLBACK_PLAN_CODE,
} from "./plan-capabilities.constants";

export interface PlanCapabilities {
  planId: string | null;
  planCode: string;
  planName: string;
  modules: string[];
  features: string[];
  apiEnabled: boolean;
  apiSearchDniEnabled: boolean;
  apiQuota: number;
  maxUsers: number;
  maxProducts: number;
}

const ACTIVE_SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING"];
const CACHE_TTL_SECONDS = 60;
const CORE_MODULE_SET = new Set(CORE_MODULES);

@Injectable()
export class PlanCapabilitiesService {
  private readonly logger = new Logger(PlanCapabilitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getCapabilities(companyId: string): Promise<PlanCapabilities> {
    const cacheKey = `plan:caps:${companyId}`;
    const cached = await this.cache.get<PlanCapabilities>(cacheKey);
    if (cached) {
      return cached;
    }

    const capabilities = await this.resolveCapabilities(companyId);
    await this.cache.set(cacheKey, capabilities, CACHE_TTL_SECONDS);
    return capabilities;
  }

  async invalidate(companyId: string): Promise<void> {
    await this.cache.del(`plan:caps:${companyId}`);
  }

  hasModule(capabilities: PlanCapabilities, module: string): boolean {
    return CORE_MODULE_SET.has(module) || capabilities.modules.includes(module);
  }

  hasFeature(capabilities: PlanCapabilities, feature: string): boolean {
    return capabilities.features.includes(feature);
  }

  private async resolveCapabilities(
    companyId: string,
  ): Promise<PlanCapabilities> {
    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: { companyId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      });

      if (
        subscription &&
        ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) &&
        subscription.plan
      ) {
        return this.fromPlan(subscription.plan);
      }

      const fallbackPlan = await this.prisma.plan.findUnique({
        where: { code: FALLBACK_PLAN_CODE },
      });

      if (fallbackPlan) {
        return this.fromPlan(fallbackPlan);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `No se pudieron resolver capacidades de plan para ${companyId}: ${err.message}`,
      );
    }

    return this.fallbackCapabilities();
  }

  private fromPlan(plan: {
    id: string;
    code: string;
    name: string;
    maxUsers: number;
    maxProducts: number;
    modules: Prisma.JsonValue | null;
    permissions: Prisma.JsonValue | null;
    apiEnabled: boolean;
    apiSearchDniEnabled: boolean;
    apiQuota: number;
  }): PlanCapabilities {
    return {
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      modules: this.toStringArray(plan.modules),
      features: this.toStringArray(plan.permissions),
      apiEnabled: plan.apiEnabled,
      apiSearchDniEnabled: plan.apiSearchDniEnabled,
      apiQuota: plan.apiQuota,
      maxUsers: plan.maxUsers,
      maxProducts: plan.maxProducts,
    };
  }

  private fallbackCapabilities(): PlanCapabilities {
    return {
      planId: null,
      planCode: FALLBACK_PLAN_CODE,
      planName: "Free",
      modules: [...CORE_MODULES],
      features: [...CORE_FEATURES],
      apiEnabled: false,
      apiSearchDniEnabled: false,
      apiQuota: 0,
      maxUsers: 1,
      maxProducts: 50,
    };
  }

  private toStringArray(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === "string");
  }
}
