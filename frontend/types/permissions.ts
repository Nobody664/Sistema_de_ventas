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
  | 'settings:update';

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
    'employee:create',
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
  ],
};
