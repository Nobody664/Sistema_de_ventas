import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CacheService } from "@/cache/cache.service";
import {
  CORE_FEATURES,
  CORE_MODULES,
  FALLBACK_PLAN_CODE,
} from "./plan-capabilities.constants";
import {
  PAID_FEATURES,
  PAID_MODULES,
  paidPlanDefaults,
  pricedPlan,
} from "./paid-plan-policy";

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
  paidBenefitsActive?: boolean;
  paidBenefitsUntil?: string;
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
    const cacheKey = `plan:caps:paid-v1:${companyId}`;
    const cached = await this.cache.get<PlanCapabilities>(cacheKey);
    if (
      cached &&
      (!cached.paidBenefitsUntil ||
        Date.parse(cached.paidBenefitsUntil) > Date.now())
    ) {
      return cached;
    }

    const capabilities = await this.resolveCapabilities(companyId);
    await this.cache.set(cacheKey, capabilities, CACHE_TTL_SECONDS);
    return capabilities;
  }

  async invalidate(companyId: string): Promise<void> {
    await this.cache.del(`plan:caps:paid-v1:${companyId}`);
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
        include: {
          plan: true,
          company: { select: { status: true } },
          payments: {
            where: { status: "SUCCEEDED", amount: { gt: 0 } },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (
        subscription &&
        ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) &&
        subscription.plan
      ) {
        const paid =
          subscription.status === "ACTIVE" &&
          subscription.company?.status === "ACTIVE" &&
          subscription.endDate > new Date() &&
          subscription.payments?.length > 0 &&
          pricedPlan(subscription.plan);
        return this.fromPlan(
          subscription.plan,
          paid,
          paid ? subscription.endDate.toISOString() : undefined,
        );
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

  private fromPlan(
    plan: {
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
      priceMonthly?: Prisma.Decimal;
      priceYearly?: Prisma.Decimal;
    },
    paid = false,
    paidUntil?: string,
  ): PlanCapabilities {
    const defaults = paidPlanDefaults(plan);
    const paidOnlyPlan = pricedPlan(plan);
    return {
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      modules: paid
        ? defaults.modules
        : this.toStringArray(plan.modules).filter(
            (module) => !(PAID_MODULES as readonly string[]).includes(module),
          ),
      features: paid
        ? defaults.permissions
        : this.toStringArray(plan.permissions).filter(
            (feature) =>
              !(PAID_FEATURES as readonly string[]).includes(feature),
          ),
      apiEnabled: paid ? true : paidOnlyPlan ? false : plan.apiEnabled,
      apiSearchDniEnabled: paid,
      apiQuota: paid ? defaults.apiQuota : paidOnlyPlan ? 0 : plan.apiQuota,
      paidBenefitsActive: paid,
      ...(paidUntil ? { paidBenefitsUntil: paidUntil } : {}),
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
