export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
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
  createdAt: string;
};

export type Employee = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
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
  isActive: boolean;
  features?: string[];
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  status: string;
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
