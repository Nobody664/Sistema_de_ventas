import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  globalRole: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z
    .object({
      memberships: z.number(),
    })
    .optional(),
});

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  timezone: z.string(),
  currency: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'PAST_DUE', 'INACTIVE']),
  trialEndsAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  subscription: SubscriptionSchema.optional(), // Singular para 1:1
  _count: z
    .object({
      memberships: z.number(),
      customers: z.number(),
      products: z.number(),
      categories: z.number(),
      sales: z.number(),
      employees: z.number(),
    })
    .optional(),
});

export const PlanSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  priceMonthly: z.string(),
  priceYearly: z.string(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  maxUsers: z.number(),
  maxProducts: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z
    .object({
      subscriptions: z.number(),
    })
    .optional(),
});

export const CategorySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z
    .object({
      products: z.number(),
    })
    .optional(),
});

export const ProductSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  categoryId: z.string().nullable(),
  name: z.string(),
  sku: z.string().optional(),
  description: z.string().optional(),
  salePrice: z.string(),
  costPrice: z.string().optional(),
  stockQuantity: z.number(),
  minStock: z.number(),
  isActive: z.boolean(),
  imageUrl: z.string().optional(),
  barcode: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CustomerSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  documentType: z.string().optional(),
  documentValue: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const EmployeeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  userId: z.string(),
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER']),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SaleSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  customerId: z.string(),
  status: z.enum(['COMPLETED', 'CANCELLED', 'REFUNDED', 'PENDING']),
  totalAmount: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SubscriptionSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  planId: z.string(),
  status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED']),
  provider: z.enum(['STRIPE', 'MERCADOPAGO', 'PAYPAL', 'CASH', 'CARD', 'TRANSFER', 'YAPE', 'PLIN']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  startDate: z.date(),
  endDate: z.date().nullable(),
  autoRenew: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z
    .object({
      payments: z.number(),
    })
    .optional(),
});

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  companyId: z.string().optional(),
  type: z.enum(['SALE', 'PAYMENT', 'INVENTORY', 'SUBSCRIPTION', 'SYSTEM']),
  channel: z.enum(['EMAIL', 'IN_APP', 'SMS', 'WHATSAPP']),
  title: z.string(),
  message: z.string(),
  isRead: z.boolean(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
});

export const PaymentSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  provider: z.enum(['STRIPE', 'MERCADOPAGO', 'PAYPAL', 'CASH', 'CARD', 'TRANSFER', 'YAPE', 'PLIN']),
  amount: z.string(),
  currency: z.string(),
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELED']),
  createdAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;
export type Company = z.infer<typeof CompanySchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type Employee = z.infer<typeof EmployeeSchema>;
export type Sale = z.infer<typeof SaleSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Payment = z.infer<typeof PaymentSchema>;

export const ApiSchemas = {
  User: UserSchema,
  Company: CompanySchema,
  Plan: PlanSchema,
  Category: CategorySchema,
  Product: ProductSchema,
  Customer: CustomerSchema,
  Employee: EmployeeSchema,
  Sale: SaleSchema,
  Subscription: SubscriptionSchema,
  Notification: NotificationSchema,
  Payment: PaymentSchema,
};