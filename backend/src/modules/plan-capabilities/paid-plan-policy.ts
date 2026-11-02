import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export const PAID_MODULES = ["storefront", "api_search_dni"] as const;
export const PAID_FEATURES = ["api.dni_search"] as const;

export interface PolicyPlan {
  code: string;
  name?: string;
  priceMonthly?: Prisma.Decimal | number | string;
  priceYearly?: Prisma.Decimal | number | string;
  modules?: unknown;
  permissions?: unknown;
  apiEnabled?: boolean;
  apiSearchDniEnabled?: boolean;
  apiQuota?: number;
}

export function pricedPlan(plan: PolicyPlan): boolean {
  return (
    new Prisma.Decimal(plan.priceMonthly ?? 0).gt(0) ||
    new Prisma.Decimal(plan.priceYearly ?? 0).gt(0)
  );
}
export function planStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
export function defaultDniQuota(code: string, name = ""): number {
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/^PLAN[ _-]+/, "")
      .replace(/[ -]+/g, "_");
  const aliases = [normalized(code), normalized(name)];
  if (
    aliases.some((key) =>
      ["SCALE", "PRO", "PROFESIONAL", "PROFESSIONAL"].includes(key),
    )
  )
    return 3000;
  if (aliases.some((key) => ["GROWTH", "MEDIO", "MEDIUM"].includes(key)))
    return 1500;
  return 500;
}

export function paidPlanDefaults(plan: PolicyPlan) {
  const modules = planStrings(plan.modules);
  const permissions = planStrings(plan.permissions);
  if (!pricedPlan(plan))
    return {
      modules,
      permissions,
      apiEnabled: plan.apiEnabled ?? false,
      apiSearchDniEnabled: plan.apiSearchDniEnabled ?? false,
      apiQuota: plan.apiQuota ?? 0,
    };
  return {
    modules: [...new Set([...modules, ...PAID_MODULES])],
    permissions: [...new Set([...permissions, ...PAID_FEATURES])],
    apiEnabled: true,
    apiSearchDniEnabled: true,
    apiQuota:
      plan.apiQuota && plan.apiQuota > 0
        ? plan.apiQuota
        : defaultDniQuota(plan.code, plan.name),
  };
}

export function validatePaidQuota(
  plan: PolicyPlan,
  suppliedQuota?: number,
): void {
  if (pricedPlan(plan) && suppliedQuota !== undefined && suppliedQuota <= 0)
    throw new BadRequestException(
      "Los planes de pago deben incluir una cuota mensual de API mayor a cero",
    );
}
