import type {
  Product,
  Customer,
  Sale,
  Company,
  Subscription,
  Plan,
  Category,
  Employee,
  Notification,
  PaymentSetting,
  SaleItem,
  CheckoutRequest,
} from '@/types/generated';

export type ProductApi = Omit<Product, 'costPrice' | 'salePrice'> & {
  costPrice: string;
  salePrice: string;
};

export type CustomerApi = Omit<Customer, 'documentValue' | 'documentType'> & {
  documentValue: string | null;
  documentType: string | null;
};

export type SaleApi = Omit<Sale, 'totalAmount' | 'subtotal' | 'taxAmount' | 'discountAmount' | 'paidAmount' | 'changeAmount'> & {
  totalAmount: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string | null;
  paidAmount: string;
  changeAmount: string;
};

export type SaleItemApi = Omit<SaleItem, 'unitPrice' | 'totalPrice'> & {
  unitPrice: string;
  totalPrice: string;
};

export type CompanyApi = Company;
export type SubscriptionApi = Subscription;
export type PlanApi = Plan;
export type CategoryApi = Category;
export type EmployeeApi = Employee;
export type NotificationApi = Notification;
export type PaymentSettingApi = PaymentSetting;
export type CheckoutRequestApi = CheckoutRequest;

export { Product, Customer, Sale, Company, Subscription, Plan, Category, Employee, Notification, PaymentSetting, SaleItem, CheckoutRequest };

export type SubscriberWithCompany = Company & {
  subscription?: SubscriptionApi | null;
  _count?: {
    users: number;
  };
};