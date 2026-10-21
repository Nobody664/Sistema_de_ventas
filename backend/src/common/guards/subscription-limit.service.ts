import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";

export type ResourceType =
  | "products"
  | "users"
  | "customers"
  | "employees"
  | "categories"
  | "sales";

export interface LimitInfo {
  current: number;
  limit: number;
  resource: ResourceType;
}

export interface SubscriptionLimits {
  maxUsers: number;
  maxProducts: number;
  maxCustomers: number;
  maxEmployees: number;
  maxCategories: number;
  features: string[];
}

@Injectable()
export class SubscriptionLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planCapabilities: PlanCapabilitiesService,
  ) {}

  async getSubscriptionLimits(companyId: string): Promise<SubscriptionLimits> {
    const capabilities = await this.planCapabilities.getCapabilities(companyId);

    return {
      maxUsers: capabilities.maxUsers,
      maxProducts: capabilities.maxProducts,
      maxCustomers: capabilities.maxProducts * 5,
      maxEmployees: capabilities.maxUsers,
      maxCategories: Math.max(1, Math.floor(capabilities.maxProducts / 20)),
      features: capabilities.features,
    };
  }

  async getCurrentCounts(
    companyId: string,
  ): Promise<Record<ResourceType, number>> {
    const [
      usersCount,
      productsCount,
      customersCount,
      employeesCount,
      categoriesCount,
    ] = await Promise.all([
      this.prisma.membership.count({
        where: { companyId, isActive: true },
      }),
      this.prisma.product.count({ where: { companyId } }),
      this.prisma.customer.count({ where: { companyId } }),
      this.prisma.employee.count({ where: { companyId } }),
      this.prisma.category.count({ where: { companyId } }),
    ]);

    return {
      products: productsCount,
      users: usersCount,
      customers: customersCount,
      employees: employeesCount,
      categories: categoriesCount,
      sales: 0,
    };
  }

  async checkLimit(
    companyId: string,
    resource: ResourceType,
  ): Promise<LimitInfo> {
    const limits = await this.getSubscriptionLimits(companyId);
    const counts = await this.getCurrentCounts(companyId);

    const resourceLimitMap: Record<ResourceType, keyof SubscriptionLimits> = {
      products: "maxProducts",
      users: "maxUsers",
      customers: "maxCustomers",
      employees: "maxEmployees",
      categories: "maxCategories",
      sales: "maxProducts",
    };

    const limitKey = resourceLimitMap[resource];
    const limit = limits[limitKey] as number;
    const current = counts[resource];

    return {
      current,
      limit,
      resource,
    };
  }

  async validateLimit(
    companyId: string,
    resource: ResourceType,
  ): Promise<void> {
    const {
      current,
      limit,
      resource: res,
    } = await this.checkLimit(companyId, resource);

    if (current >= limit) {
      const resourceNames: Record<ResourceType, string> = {
        products: "productos",
        users: "usuarios",
        customers: "clientes",
        employees: "empleados",
        categories: "categorías",
        sales: "ventas",
      };

      const capabilities =
        await this.planCapabilities.getCapabilities(companyId);

      throw new ForbiddenException({
        error: "LIMIT_EXCEEDED",
        message: `Has alcanzado el límite de ${resourceNames[res]} de tu plan (${limit}).`,
        current,
        limit,
        resource: res,
        planName: capabilities.planName,
        upgradeUrl: "/subscription",
      });
    }
  }

  async getAllLimitsInfo(companyId: string): Promise<{
    limits: SubscriptionLimits;
    usage: Record<ResourceType, number>;
    percentages: Record<ResourceType, number>;
  }> {
    const limits = await this.getSubscriptionLimits(companyId);
    const counts = await this.getCurrentCounts(companyId);

    const usage: Record<ResourceType, number> = {
      products: counts.products,
      users: counts.users,
      customers: counts.customers,
      employees: counts.employees,
      categories: counts.categories,
      sales: 0,
    };

    const percentages: Record<ResourceType, number> = {
      products: Math.round((counts.products / limits.maxProducts) * 100),
      users: Math.round((counts.users / limits.maxUsers) * 100),
      customers: Math.round((counts.customers / limits.maxCustomers) * 100),
      employees: Math.round((counts.employees / limits.maxEmployees) * 100),
      categories: Math.round(
        (counts.categories / Math.max(1, limits.maxCategories)) * 100,
      ),
      sales: 0,
    };

    return { limits, usage, percentages };
  }
}
