import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CreatePlanDto, UpdatePlanDto } from "./dto/plan.dto";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import {
  paidPlanDefaults,
  validatePaidQuota,
} from "@/modules/plan-capabilities/paid-plan-policy";
import { rejectNullFields } from "@/common/helpers/patch-contract.helper";

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: PlanCapabilitiesService,
  ) {}

  async findPublicPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
    });
    return plans.map((plan) => ({ ...plan, ...paidPlanDefaults(plan) }));
  }

  async findAllAdmin() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
    });
    return plans.map((plan) => ({ ...plan, ...paidPlanDefaults(plan) }));
  }

  create(input: CreatePlanDto) {
    validatePaidQuota(input, input.apiQuota);
    return this.prisma.plan.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        priceMonthly: input.priceMonthly,
        priceYearly: input.priceYearly,
        billingCycle: input.billingCycle,
        maxUsers: input.maxUsers,
        maxProducts: input.maxProducts,
        features: input.features,
        ...paidPlanDefaults(input),
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(id: string, input: UpdatePlanDto) {
    rejectNullFields(input, [
      "name",
      "priceMonthly",
      "priceYearly",
      "billingCycle",
      "modules",
      "permissions",
      "apiEnabled",
      "apiSearchDniEnabled",
      "apiQuota",
      "isActive",
    ]);
    const changes = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as UpdatePlanDto;
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException("Plan not found.");
    }

    validatePaidQuota({ ...plan, ...changes }, input.apiQuota);
    const updated = await this.prisma.plan.update({
      where: { id },
      data: { ...changes, ...paidPlanDefaults({ ...plan, ...changes }) },
    });
    let cursor: string | undefined;
    for (;;) {
      const subscriptions = await this.prisma.subscription.findMany({
        where: { planId: id },
        select: { id: true, companyId: true },
        orderBy: { id: "asc" },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      await Promise.all(
        subscriptions.map((subscription) =>
          this.capabilities.invalidate(subscription.companyId),
        ),
      );
      if (subscriptions.length < 200) break;
      cursor = subscriptions.at(-1)!.id;
    }
    return updated;
  }

  async remove(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException("Plan not found.");
    }

    return this.prisma.plan.delete({ where: { id } });
  }
}
