import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class PlatformMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      companiesByStatus,
      usersTotal,
      platformAdmins,
      activeSubscriptionsByPlan,
      activePlans,
      revenue,
      pendingCheckouts,
      pendingUpgrades,
    ] = await Promise.all([
      this.prisma.company.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { globalRole: { in: ["SUPER_ADMIN", "SUPPORT_ADMIN"] } },
      }),
      this.prisma.subscription.groupBy({
        by: ["planId"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
      }),
      this.prisma.plan.count({ where: { isActive: true } }),
      this.prisma.payment.aggregate({
        where: { status: "SUCCEEDED", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.checkoutRequest.count({ where: { status: "SUBMITTED" } }),
      this.prisma.planUpgradeRequest.count({ where: { status: "PENDING" } }),
    ]);

    const planIds = activeSubscriptionsByPlan.map((entry) => entry.planId);
    const plans = await this.prisma.plan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, code: true, name: true },
    });
    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    const byStatus: Record<string, number> = {};
    let companiesTotal = 0;
    for (const group of companiesByStatus) {
      byStatus[group.status] = group._count._all;
      companiesTotal += group._count._all;
    }

    const subscriptionsByPlan = activeSubscriptionsByPlan.map((entry) => {
      const plan = planById.get(entry.planId);
      return {
        planId: entry.planId,
        code: plan?.code ?? null,
        name: plan?.name ?? null,
        count: entry._count._all,
      };
    });

    const activeSubscriptions = activeSubscriptionsByPlan.reduce(
      (total, entry) => total + entry._count._all,
      0,
    );

    return {
      generatedAt: now.toISOString(),
      companies: {
        total: companiesTotal,
        byStatus,
      },
      users: {
        total: usersTotal,
        platformAdmins,
      },
      plans: {
        active: activePlans,
      },
      subscriptions: {
        active: activeSubscriptions,
        byPlan: subscriptionsByPlan,
      },
      revenue: {
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        currency: "PEN",
        total: Number(revenue._sum.amount ?? 0),
      },
      requests: {
        pendingCheckouts,
        pendingUpgrades,
      },
    };
  }
}
