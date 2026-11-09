import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import {
  StoreAdminContext,
  StoreAdminPolicyService,
} from "./store-admin-policy.service";

export interface StoreAdminUser {
  sub: string;
  companyId?: string | null;
  roles?: string[];
}

@Injectable()
export class StoreAdminContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanCapabilitiesService,
    private readonly policy: StoreAdminPolicyService,
  ) {}

  async resolve(user: StoreAdminUser): Promise<StoreAdminContext> {
    if (!user.companyId)
      throw new ForbiddenException("Se requiere una empresa activa");

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.sub,
        companyId: user.companyId,
        role: "COMPANY_ADMIN",
        isActive: true,
      },
      select: {
        id: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
            currency: true,
            status: true,
            storeAdminFeatures: {
              select: { appearance: true, notes: true, savedViews: true },
            },
            storefront: {
              select: { enabled: true, checkoutEnabled: true, title: true },
            },
          },
        },
      },
    });

    if (!membership)
      throw new ForbiddenException(
        "Se requiere una membresía activa de administrador de esta empresa",
      );

    const company = membership.company;
    const capabilities = await this.plans.getCapabilities(company.id);
    const mode = this.policy.mode({
      companyStatus: company.status,
      storefrontModule: this.plans.hasModule(capabilities, "storefront"),
    });
    const storeCapabilities = this.policy.capabilities(mode);

    return {
      mode,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        timezone: company.timezone,
        currency: company.currency,
        status: company.status,
      },
      store: {
        title: company.storefront?.title?.trim() || company.name,
        slug: company.slug,
        enabled: company.storefront?.enabled ?? false,
        checkoutEnabled: company.storefront?.checkoutEnabled ?? false,
      },
      capabilities: storeCapabilities,
      extensions: {
        appearance:
          mode === "MANAGE" &&
          (company.storeAdminFeatures?.appearance ?? false),
        notes:
          mode === "MANAGE" && (company.storeAdminFeatures?.notes ?? false),
        savedViews:
          mode === "MANAGE" &&
          (company.storeAdminFeatures?.savedViews ?? false),
      },
      access: {
        attendExistingOrders: storeCapabilities.attendExistingOrders,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
