export const PLAN_MODULE_KEYS = [
  "dashboard",
  "notifications",
  "products",
  "categories",
  "inventory",
  "sales",
  "customers",
  "distributors",
  "employees",
  "reports",
  "api",
  "api_search_dni",
  "webhooks",
] as const;

export type PlanModuleKey = (typeof PLAN_MODULE_KEYS)[number];

export const PLAN_FEATURE_KEYS = [
  "reports.basic",
  "reports.advanced",
  "reports.export",
  "sales.discounts",
  "inventory.kardex",
  "inventory.batches",
  "inventory.multi_branch",
  "api.access",
  "api.dni_search",
  "webhooks.manage",
  "users.manage",
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];

export const CORE_MODULES: string[] = ["dashboard", "notifications"];
export const CORE_FEATURES: string[] = [];

export const FALLBACK_PLAN_CODE = "FREE";
