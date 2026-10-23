import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PlanCapabilitiesService } from "./plan-capabilities.service";

export interface ApiQuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  period: string;
}

@Injectable()
export class ApiQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planCapabilities: PlanCapabilitiesService,
  ) {}

  private currentPeriod(date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  async getUsage(companyId: string): Promise<ApiQuotaResult> {
    const capabilities = await this.planCapabilities.getCapabilities(companyId);
    const period = this.currentPeriod();

    const usage = await this.prisma.apiUsage.findUnique({
      where: { companyId_period: { companyId, period } },
    });

    const used = usage?.count ?? 0;
    const limit = capabilities.apiQuota;

    return {
      allowed: limit > 0 && used < limit,
      used,
      limit,
      remaining: limit > 0 ? Math.max(0, limit - used) : 0,
      period,
    };
  }

  async consume(companyId: string, amount = 1): Promise<ApiQuotaResult> {
    const capabilities = await this.planCapabilities.getCapabilities(companyId);
    const period = this.currentPeriod();

    if (!capabilities.apiEnabled || capabilities.apiQuota <= 0) {
      throw new HttpException(
        {
          error: "FEATURE_NOT_AVAILABLE",
          message: "Tu plan no incluye acceso a la API.",
          currentPlan: capabilities.planCode,
          upgradeUrl: "/subscription",
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const usage = await this.prisma.apiUsage.findUnique({
      where: { companyId_period: { companyId, period } },
    });

    const used = usage?.count ?? 0;

    if (used + amount > capabilities.apiQuota) {
      throw new HttpException(
        {
          error: "API_QUOTA_EXCEEDED",
          message: "Has superado la cuota mensual de la API de tu plan.",
          used,
          limit: capabilities.apiQuota,
          period,
          currentPlan: capabilities.planCode,
          upgradeUrl: "/subscription",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const updated = await this.prisma.apiUsage.upsert({
      where: { companyId_period: { companyId, period } },
      create: { companyId, period, count: amount },
      update: { count: { increment: amount } },
    });

    return {
      allowed: true,
      used: updated.count,
      limit: capabilities.apiQuota,
      remaining: Math.max(0, capabilities.apiQuota - updated.count),
      period,
    };
  }
}
