export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  costPrice: string;
  salePrice: string;
  stockQuantity: number;
  minStock: number;
  status: string;
  categoryId: string | null;
  category?: Category;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count?: { products: number };
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentValue: string | null;
  notes: string | null;
  totalPurchases: number;
  sales?: Array<{ totalAmount: string | number }>;
  createdAt: string;
};

export type Employee = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  dni: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  user?: { id: string; email: string } | null;
};

export type Sale = {
  id: string;
  saleNumber: string;
  totalAmount: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  paymentMethod: string;
  status: string;
  paidAt: string;
  customer?: { firstName: string; lastName: string };
  employee?: { firstName: string; lastName: string };
  items: Array<{ id: string; productId: string; productName: string; quantity: number; unitPrice: string; totalAmount: string }>;
};

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  billingCycle: string;
  maxUsers: number | null;
  maxProducts: number | null;
  features: string[] | Record<string, unknown>;
  isActive: boolean;
};

export type Notification = {
  id: string;
  userId: string;
  companyId: string | null;
  type: string;
  channel: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  sentAt: string | null;
  createdAt: string;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  trialEndsAt: string | null;
  currency: string;
  timezone: string;
  createdAt: string;
  subscription?: {
    id: string;
    status: string;
    provider: string | null;
    billingCycle: string;
    startDate: string;
    endDate: string | null;
    plan?: { name: string; priceMonthly: string };
  } | null;
  _count?: { memberships: number; customers: number };
};

export type SubscriberWithCompany = {
  id: string;
  companyId: string;
  planId: string;
  status: string;
  billingCycle: string;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  createdAt: string;
  plan?: Plan;
  company?: {
    id: string;
    name: string;
    email: string | null;
    status: string;
    createdAt: string;
  };
  payments?: Array<{
    id: string;
    amount: string;
    status: string;
    createdAt: string;
  }>;
};

export type Subscription = {
  id: string;
  companyId: string;
  planId: string;
  status: string;
  billingCycle: string;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: Plan;
  payments?: Array<{
    id: string;
    amount: string;
    status: string;
    createdAt: string;
  }>;
};
