export type Permission =
  | 'product:list'
  | 'product:create'
  | 'product:update'
  | 'product:delete'
  | 'product:export'
  | 'product:view_low_stock'
  | 'category:list'
  | 'category:create'
  | 'category:update'
  | 'category:delete'
  | 'customer:list'
  | 'customer:create'
  | 'customer:update'
  | 'customer:delete'
  | 'employee:list'
  | 'employee:create'
  | 'employee:update'
  | 'employee:delete'
  | 'sale:list'
  | 'sale:create'
  | 'sale:view_detail'
  | 'sale:cancel'
  | 'sale:export'
  | 'inventory:view'
  | 'inventory:inbound'
  | 'inventory:outbound'
  | 'inventory:adjust'
  | 'cash:open_close'
  | 'cash:view_report'
  | 'dashboard:view'
  | 'report:sales'
  | 'report:financial'
  | 'company:view'
  | 'company:update'
  | 'company:manage_plans'
  | 'company:view_audit'
  | 'company:manage_all'
  | 'subscription:view'
  | 'subscription:manage'
  | 'user:manage'
  | 'settings:read'
  | 'settings:update'
  | 'platform:view'
  | 'platform:companies_manage'
  | 'platform:plans_manage'
  | 'platform:settings_manage'
  | 'platform:admins_manage'
  | 'platform:audit_view'
  | 'distributor:list'
  | 'distributor:create'
  | 'distributor:update'
  | 'distributor:delete'
  | 'distributor:view'
  | 'distributor:transfer'
  | 'distributor:deliver'
  | 'distributor:settle'
  | 'discount:list'
  | 'discount:manage';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    'product:list',
    'product:create',
    'product:update',
    'product:delete',
    'product:export',
    'product:view_low_stock',
    'category:list',
    'category:create',
    'category:update',
    'category:delete',
    'customer:list',
    'customer:create',
    'customer:update',
    'customer:delete',
    'employee:list',
    'employee:create',
    'employee:update',
    'employee:delete',
    'sale:list',
    'sale:create',
    'sale:view_detail',
    'sale:cancel',
    'sale:export',
    'inventory:view',
    'inventory:inbound',
    'inventory:outbound',
    'inventory:adjust',
    'cash:open_close',
    'cash:view_report',
    'dashboard:view',
    'report:sales',
    'report:financial',
    'company:view',
    'company:update',
    'company:manage_plans',
    'company:view_audit',
    'company:manage_all',
    'subscription:view',
    'subscription:manage',
    'user:manage',
    'settings:read',
    'settings:update',
    'platform:view',
    'platform:companies_manage',
    'platform:plans_manage',
    'platform:settings_manage',
    'platform:admins_manage',
    'platform:audit_view',
    'distributor:list',
    'distributor:create',
    'distributor:update',
    'distributor:delete',
    'distributor:view',
    'distributor:transfer',
    'distributor:deliver',
    'distributor:settle',
    'discount:list',
    'discount:manage',
  ],

  COMPANY_ADMIN: [
    'product:list',
    'product:create',
    'product:update',
    'product:delete',
    'product:export',
    'product:view_low_stock',
    'category:list',
    'category:create',
    'category:update',
    'category:delete',
    'customer:list',
    'customer:create',
    'customer:update',
    'customer:delete',
    'employee:list',
    'employee:create',
    'employee:update',
    'employee:delete',
    'sale:list',
    'sale:create',
    'sale:view_detail',
    'sale:cancel',
    'sale:export',
    'inventory:view',
    'inventory:inbound',
    'inventory:outbound',
    'inventory:adjust',
    'cash:open_close',
    'cash:view_report',
    'dashboard:view',
    'report:sales',
    'report:financial',
    'company:view',
    'company:update',
    'subscription:view',
    'settings:read',
    'settings:update',
    'distributor:list',
    'distributor:create',
    'distributor:update',
    'distributor:delete',
    'distributor:view',
    'distributor:transfer',
    'distributor:deliver',
    'distributor:settle',
    'discount:list',
    'discount:manage',
  ],

  MANAGER: [
    'product:list',
    'product:create',
    'product:update',
    'product:export',
    'product:view_low_stock',
    'category:list',
    'category:create',
    'category:update',
    'customer:list',
    'customer:create',
    'customer:update',
    'employee:list',
    'sale:list',
    'sale:create',
    'sale:view_detail',
    'sale:cancel',
    'sale:export',
    'inventory:view',
    'inventory:inbound',
    'inventory:outbound',
    'cash:open_close',
    'cash:view_report',
    'dashboard:view',
    'report:sales',
    'report:financial',
    'company:view',
    'subscription:view',
    'settings:read',
    'distributor:list',
    'distributor:create',
    'distributor:update',
    'distributor:view',
    'distributor:transfer',
    'distributor:deliver',
    'discount:list',
  ],

  CASHIER: [
    'product:list',
    'customer:list',
    'customer:create',
    'customer:update',
    'sale:list',
    'sale:create',
    'sale:view_detail',
    'cash:open_close',
    'cash:view_report',
    'dashboard:view',
    'report:sales',
    'company:view',

    'discount:list',
  ],

  VIEWER: [
    'product:list',
    'category:list',
    'customer:list',
    'sale:list',
    'sale:view_detail',
    'dashboard:view',
    'report:sales',
    'company:view',
    'subscription:view',
  ],

  SUPPORT_ADMIN: [
    'company:view',
    'company:manage_all',
    'subscription:view',
    'subscription:manage',
    'user:manage',
    'platform:view',
    'platform:audit_view',
  ],
};
