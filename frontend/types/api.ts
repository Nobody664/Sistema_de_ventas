import type {
  Product,
  Customer,
  Sale as GeneratedSale,
  Company,
  Subscription,
  Plan,
  Category,
  Employee,
  Notification as GeneratedNotification,
  PaymentSetting,
  SaleItem,
  CheckoutRequest,
  InventoryKardex,
  ProductBatch,
  Branch,
} from "@/types/generated";

export type Sale = GeneratedSale & {
  sellerId?: string | null;
  seller?: { id: string; fullName: string } | null;
};

export type ProductApi = Omit<Product, "costPrice" | "salePrice"> & {
  costPrice: string;
  salePrice: string;
};

export type CustomerApi = Omit<Customer, "documentValue" | "documentType"> & {
  documentValue: string | null;
  documentType: string | null;
};

export type SaleApi = Omit<
  Sale,
  | "totalAmount"
  | "subtotal"
  | "taxAmount"
  | "discountAmount"
  | "paidAmount"
  | "changeAmount"
> & {
  totalAmount: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string | null;
  paidAmount: string;
  changeAmount: string;
};

export type SaleItemApi = Omit<SaleItem, "unitPrice" | "totalPrice"> & {
  unitPrice: string;
  totalPrice: string;
};

export type CompanyApi = Company;
export type SubscriptionApi = Subscription;
export type PlanApi = Plan;
export type CategoryApi = Category;
export type EmployeeApi = Employee;
export type Notification = Omit<GeneratedNotification, "userId"> & {
  userId: string | null;
  scope?: "COMPANY" | "PLATFORM";
  globalTarget?: string | null;
  actionUrl?: string | null;
};
export type NotificationApi = Notification;
export type PaymentSettingApi = PaymentSetting;
export type CheckoutRequestApi = CheckoutRequest;

export {
  Product,
  Customer,
  Company,
  Subscription,
  Plan,
  Category,
  Employee,
  PaymentSetting,
  SaleItem,
  CheckoutRequest,
  InventoryKardex,
  ProductBatch,
  Branch,
};

export type SubscriberWithCompany = Company & {
  subscription?: {
    id: string;
    status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
    billingCycle: "MONTHLY" | "YEARLY";
    startDate: Date;
    endDate?: Date | null;
    plan?: {
      id: string;
      name: string;
      code: string;
      priceMonthly: string;
      priceYearly: string;
    };
    company?: Company;
    autoRenew?: boolean;
    payments?: Array<{
      id: string;
      amount: string;
      status: string;
      paidAt?: Date;
    }>;
  } | null;
  _count?: {
    users: number;
  };
};
export interface DiscountCoupon {
  id: string;
  companyId: string;
  code: string;
  description?: string | null;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  maxUses?: number | null;
  usedCount?: number;
  minPurchase?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type FinanceDirection = "ENTRY" | "EXIT";

export type FinanceCategory =
  | "PURCHASE"
  | "SALE"
  | "PAYROLL"
  | "ELECTRICITY"
  | "WATER"
  | "MAINTENANCE"
  | "OTHER";

export type FinanceSource = "MANUAL" | "SALE";

export interface FinanceRecord {
  id: string;
  source: FinanceSource;
  direction: FinanceDirection;
  category: FinanceCategory;
  description: string;
  amount: number;
  currency: string;
  recordDate: string;
  dueDate: string | null;
  reference: string | null;
  supplier: string | null;
  notes: string | null;
  employeeId: string | null;
  employeeName: string | null;
  editable: boolean;
  createdAt: string;
}

export interface FinanceWeekBucket {
  start: string;
  end: string;
  entries: number;
  exits: number;
  sales: number;
  expenses: number;
  balance: number;
}

export interface FinanceSummary {
  from: string;
  to: string;
  entries: { total: number; count: number };
  exits: { total: number; count: number };
  sales: { total: number; count: number };
  expenses: { total: number; count: number };
  balance: number;
  byCategory: Record<string, number>;
  weeks: FinanceWeekBucket[];
}

export interface FinanceListResponse {
  items: FinanceRecord[];
  total: number;
  page: number;
  limit: number;
}
