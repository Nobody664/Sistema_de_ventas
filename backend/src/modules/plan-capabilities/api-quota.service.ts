import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
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
      allowed: capabilities.apiEnabled && limit > 0 && used < limit,
      used,
      limit,
      remaining: limit > 0 ? Math.max(0, limit - used) : 0,
      period,
    };
  }

  async assertAccess(companyId: string): Promise<void> {
    const capabilities = await this.planCapabilities.getCapabilities(companyId);
    if (!capabilities.apiEnabled || capabilities.apiQuota <= 0)
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

  async consume(companyId: string, amount = 1): Promise<ApiQuotaResult> {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647)
      throw new BadRequestException("El consumo debe ser un entero positivo");
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

    return serializableTransaction(this.prisma, async (tx) => {
      const usage = await tx.apiUsage.upsert({
        where: { companyId_period: { companyId, period } },
        create: { companyId, period, count: 0 },
        update: {},
      });
      const claimed = await tx.apiUsage.updateMany({
        where: { id: usage.id, count: { lte: capabilities.apiQuota - amount } },
        data: { count: { increment: amount } },
      });
      if (claimed.count !== 1) {
        throw new HttpException(
          {
            error: "API_QUOTA_EXCEEDED",
            message: "Has superado la cuota mensual de la API de tu plan.",
            used: usage.count,
            limit: capabilities.apiQuota,
            period,
            currentPlan: capabilities.planCode,
            upgradeUrl: "/subscription",
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const used = usage.count + amount;

      return {
        allowed: true,
        used,
        limit: capabilities.apiQuota,
        remaining: Math.max(0, capabilities.apiQuota - used),
        period,
      };
    });
  }
}
