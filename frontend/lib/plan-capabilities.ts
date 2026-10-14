export interface ApiUsageSummary {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  period: string;
}

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
  apiUsage?: ApiUsageSummary | null;
}

export const PLAN_MODULE_KEYS = [
  'dashboard',
  'notifications',
  'products',
  'categories',
  'inventory',
  'sales',
  'customers',
  'distributors',
  'employees',
  'reports',
  'api',
  'api_search_dni',
  'webhooks',
] as const;

export type PlanModuleKey = (typeof PLAN_MODULE_KEYS)[number];

export const PLAN_FEATURE_KEYS = [
  'reports.basic',
  'reports.advanced',
  'reports.export',
  'sales.discounts',
  'inventory.kardex',
  'inventory.batches',
  'inventory.multi_branch',
  'api.access',
  'api.dni_search',
  'webhooks.manage',
  'users.manage',
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];

export const CORE_MODULES: string[] = ['dashboard', 'notifications'];
const CORE_MODULE_SET = new Set(CORE_MODULES);

export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  notifications: 'Notificaciones',
  products: 'Productos',
  categories: 'Categorías',
  inventory: 'Inventario',
  sales: 'Ventas',
  customers: 'Clientes',
  distributors: 'Distribuidores',
  employees: 'Empleados',
  reports: 'Reportes',
  api: 'Acceso API',
  api_search_dni: 'Consulta DNI/RUC',
  webhooks: 'Webhooks',
};

export const FEATURE_LABELS: Record<string, string> = {
  'reports.basic': 'Reportes básicos',
  'reports.export': 'Exportar reportes',
  'reports.advanced': 'Reportes avanzados',
  'sales.discounts': 'Descuentos en ventas',
  'inventory.kardex': 'Kardex valorizado',
  'inventory.batches': 'Lotes (FEFO)',
  'inventory.multi_branch': 'Múltiples sucursales',
  'api.access': 'Acceso a la API',
  'api.dni_search': 'Consulta DNI/RUC por API',
  'webhooks.manage': 'Webhooks',
  'users.manage': 'Gestión avanzada de usuarios',
};

export interface RouteRequirement {
  module?: string;
  feature?: string;
}

const ROUTE_REQUIREMENTS: Array<{ prefix: string; requirement: RouteRequirement }> = [
  { prefix: '/inventory/kardex', requirement: { module: 'inventory', feature: 'inventory.kardex' } },
  { prefix: '/inventory/batches', requirement: { module: 'inventory', feature: 'inventory.batches' } },
  { prefix: '/distributors', requirement: { module: 'distributors' } },
  { prefix: '/employees', requirement: { module: 'employees' } },
];

export function getRouteRequirement(pathname: string): RouteRequirement | null {
  const match = ROUTE_REQUIREMENTS.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  return match?.requirement ?? null;
}

export function hasModule(capabilities: PlanCapabilities | null | undefined, module: string): boolean {
  if (!capabilities) return true;
  if (CORE_MODULE_SET.has(module)) return true;
  return capabilities.modules.includes(module);
}

export function hasFeature(capabilities: PlanCapabilities | null | undefined, feature: string): boolean {
  if (!capabilities) return true;
  return capabilities.features.includes(feature);
}

export function satisfiesRequirement(
  capabilities: PlanCapabilities | null | undefined,
  requirement: RouteRequirement | null,
): boolean {
  if (!capabilities || !requirement) return true;
  if (requirement.module && !hasModule(capabilities, requirement.module)) return false;
  if (requirement.feature && !hasFeature(capabilities, requirement.feature)) return false;
  return true;
}

export function missingRequirementLabel(requirement: RouteRequirement | null): string | null {
  if (!requirement) return null;
  if (requirement.feature && FEATURE_LABELS[requirement.feature]) return FEATURE_LABELS[requirement.feature];
  if (requirement.module && MODULE_LABELS[requirement.module]) return MODULE_LABELS[requirement.module];
  return null;
}
