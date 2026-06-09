export enum Permission {
  // Products
  PRODUCT_LIST = 'product:list',
  PRODUCT_CREATE = 'product:create',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',
  PRODUCT_EXPORT = 'product:export',
  PRODUCT_VIEW_LOW_STOCK = 'product:view_low_stock',

  // Categories
  CATEGORY_LIST = 'category:list',
  CATEGORY_CREATE = 'category:create',
  CATEGORY_UPDATE = 'category:update',
  CATEGORY_DELETE = 'category:delete',

  // Customers
  CUSTOMER_LIST = 'customer:list',
  CUSTOMER_CREATE = 'customer:create',
  CUSTOMER_UPDATE = 'customer:update',
  CUSTOMER_DELETE = 'customer:delete',

  // Employees
  EMPLOYEE_LIST = 'employee:list',
  EMPLOYEE_CREATE = 'employee:create',
  EMPLOYEE_UPDATE = 'employee:update',
  EMPLOYEE_DELETE = 'employee:delete',

  // Sales
  SALE_LIST = 'sale:list',
  SALE_CREATE = 'sale:create',
  SALE_VIEW_DETAIL = 'sale:view_detail',
  SALE_CANCEL = 'sale:cancel',
  SALE_EXPORT = 'sale:export',

  // Inventory
  INVENTORY_VIEW = 'inventory:view',
  INVENTORY_INBOUND = 'inventory:inbound',
  INVENTORY_OUTBOUND = 'inventory:outbound',
  INVENTORY_ADJUST = 'inventory:adjust',

  // Cash
  CASH_OPEN_CLOSE = 'cash:open_close',
  CASH_VIEW_REPORT = 'cash:view_report',

  // Dashboard & Reports
  DASHBOARD_VIEW = 'dashboard:view',
  REPORT_SALES = 'report:sales',
  REPORT_FINANCIAL = 'report:financial',

  // Company
  COMPANY_VIEW = 'company:view',
  COMPANY_UPDATE = 'company:update',
  COMPANY_MANAGE_PLANS = 'company:manage_plans',
  COMPANY_VIEW_AUDIT = 'company:view_audit',
  COMPANY_MANAGE_ALL = 'company:manage_all',

  // Subscriptions
  SUBSCRIPTION_VIEW = 'subscription:view',
  SUBSCRIPTION_MANAGE = 'subscription:manage',

  // Users (admin)
  USER_MANAGE = 'user:manage',

  // Kardex
  KARDEX_VIEW = 'kardex:view',
  KARDEX_EXPORT = 'kardex:export',

  // Replenishment
  REPLENISHMENT_VIEW = 'replenishment:view',
  REPLENISHMENT_MANAGE = 'replenishment:manage',

  // Forecast
  FORECAST_VIEW = 'forecast:view',

  // Branches
  BRANCH_MANAGE = 'branch:manage',
}

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission),

  COMPANY_ADMIN: [
    Permission.PRODUCT_LIST,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.PRODUCT_EXPORT,
    Permission.PRODUCT_VIEW_LOW_STOCK,

    Permission.CATEGORY_LIST,
    Permission.CATEGORY_CREATE,
    Permission.CATEGORY_UPDATE,
    Permission.CATEGORY_DELETE,

    Permission.CUSTOMER_LIST,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.CUSTOMER_DELETE,

    Permission.EMPLOYEE_LIST,
    Permission.EMPLOYEE_CREATE,
    Permission.EMPLOYEE_UPDATE,
    Permission.EMPLOYEE_DELETE,

    Permission.SALE_LIST,
    Permission.SALE_CREATE,
    Permission.SALE_VIEW_DETAIL,
    Permission.SALE_CANCEL,
    Permission.SALE_EXPORT,

    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_INBOUND,
    Permission.INVENTORY_OUTBOUND,
    Permission.INVENTORY_ADJUST,

    Permission.CASH_OPEN_CLOSE,
    Permission.CASH_VIEW_REPORT,

    Permission.DASHBOARD_VIEW,
    Permission.REPORT_SALES,
    Permission.REPORT_FINANCIAL,

    Permission.COMPANY_VIEW,
    Permission.COMPANY_UPDATE,

    Permission.SUBSCRIPTION_VIEW,

    Permission.KARDEX_VIEW,
    Permission.KARDEX_EXPORT,
    Permission.REPLENISHMENT_VIEW,
    Permission.FORECAST_VIEW,
  ],

  MANAGER: [
    Permission.PRODUCT_LIST,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_EXPORT,
    Permission.PRODUCT_VIEW_LOW_STOCK,

    Permission.CATEGORY_LIST,
    Permission.CATEGORY_CREATE,
    Permission.CATEGORY_UPDATE,

    Permission.CUSTOMER_LIST,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,

    Permission.EMPLOYEE_LIST,
    Permission.EMPLOYEE_CREATE,

    Permission.SALE_LIST,
    Permission.SALE_CREATE,
    Permission.SALE_VIEW_DETAIL,
    Permission.SALE_CANCEL,
    Permission.SALE_EXPORT,

    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_INBOUND,
    Permission.INVENTORY_OUTBOUND,

    Permission.CASH_OPEN_CLOSE,
    Permission.CASH_VIEW_REPORT,

    Permission.DASHBOARD_VIEW,
    Permission.REPORT_SALES,
    Permission.REPORT_FINANCIAL,

    Permission.COMPANY_VIEW,

    Permission.SUBSCRIPTION_VIEW,

    Permission.KARDEX_VIEW,
    Permission.REPLENISHMENT_VIEW,
  ],

  CASHIER: [
    Permission.PRODUCT_LIST,
    Permission.CUSTOMER_LIST,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.SALE_LIST,
    Permission.SALE_CREATE,
    Permission.SALE_VIEW_DETAIL,
    Permission.CASH_OPEN_CLOSE,
    Permission.CASH_VIEW_REPORT,
    Permission.DASHBOARD_VIEW,
    Permission.REPORT_SALES,
    Permission.COMPANY_VIEW,
  ],

  VIEWER: [
    Permission.PRODUCT_LIST,
    Permission.CUSTOMER_LIST,
    Permission.SALE_LIST,
    Permission.SALE_VIEW_DETAIL,
    Permission.DASHBOARD_VIEW,
    Permission.REPORT_SALES,
    Permission.COMPANY_VIEW,
    Permission.SUBSCRIPTION_VIEW,
  ],

  SUPPORT_ADMIN: [
    Permission.COMPANY_VIEW,
    Permission.COMPANY_MANAGE_ALL,
    Permission.SUBSCRIPTION_VIEW,
    Permission.SUBSCRIPTION_MANAGE,
    Permission.USER_MANAGE,
  ],
};
