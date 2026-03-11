export type Permission =
  | 'products:read'
  | 'products:create'
  | 'products:update'
  | 'products:delete'
  | 'categories:read'
  | 'categories:create'
  | 'categories:update'
  | 'categories:delete'
  | 'customers:read'
  | 'customers:create'
  | 'customers:update'
  | 'customers:delete'
  | 'employees:read'
  | 'employees:create'
  | 'employees:update'
  | 'employees:delete'
  | 'companies:read'
  | 'companies:create'
  | 'companies:update'
  | 'companies:delete'
  | 'sales:read'
  | 'sales:create'
  | 'sales:delete'
  | 'reports:read'
  | 'reports:export'
  | 'dashboard:read'
  | 'settings:read'
  | 'settings:update';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    'products:read',
    'products:create',
    'products:update',
    'products:delete',
    'categories:read',
    'categories:create',
    'categories:update',
    'categories:delete',
    'customers:read',
    'customers:create',
    'customers:update',
    'customers:delete',
    'employees:read',
    'employees:create',
    'employees:update',
    'employees:delete',
    'companies:read',
    'companies:create',
    'companies:update',
    'companies:delete',
    'sales:read',
    'sales:create',
    'sales:delete',
    'reports:read',
    'reports:export',
    'dashboard:read',
    'settings:read',
    'settings:update',
  ],
  COMPANY_ADMIN: [
    'products:read',
    'products:create',
    'products:update',
    'products:delete',
    'categories:read',
    'categories:create',
    'categories:update',
    'categories:delete',
    'customers:read',
    'customers:create',
    'customers:update',
    'customers:delete',
    'employees:read',
    'employees:create',
    'employees:update',
    'employees:delete',
    'sales:read',
    'sales:create',
    'sales:delete',
    'reports:read',
    'reports:export',
    'dashboard:read',
    'settings:read',
    'settings:update',
  ],
  MANAGER: [
    'products:read',
    'products:create',
    'products:update',
    'categories:read',
    'categories:create',
    'categories:update',
    'customers:read',
    'customers:create',
    'customers:update',
    'employees:read',
    'employees:create',
    'sales:read',
    'sales:create',
    'reports:read',
    'dashboard:read',
  ],
  CASHIER: [
    'products:read',
    'customers:read',
    'customers:create',
    'customers:update',
    'sales:read',
    'sales:create',
    'dashboard:read',
  ],
  STAFF: ['products:read', 'dashboard:read'],
};
