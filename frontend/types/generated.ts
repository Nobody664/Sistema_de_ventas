// Generated types from Prisma Schema
// DO NOT EDIT - Run `prisma generate` to regenerate

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PAST_DUE' | 'INACTIVE';
export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELED';
export type PaymentProvider = 'STRIPE' | 'MERCADOPAGO' | 'PAYPAL' | 'CASH' | 'CARD' | 'TRANSFER' | 'YAPE' | 'PLIN';
export type GlobalRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type MembershipRole = 'COMPANY_ADMIN' | 'MANAGER' | 'CASHIER' | 'VIEWER';
export type SaleStatus = 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PENDING';
export type NotificationType = 'SALE' | 'PAYMENT' | 'INVENTORY' | 'SUBSCRIPTION' | 'SYSTEM';
export type NotificationChannel = 'EMAIL' | 'IN_APP' | 'SMS' | 'WHATSAPP';
export type PlanUpgradeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CheckoutRequestStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT';
export type InventoryMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';
export type ProofStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  globalRole: GlobalRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberships?: Membership[];
  notifications?: Notification[];
  _count?: {
    memberships: number;
  };
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  timezone: string;
  currency: string;
  status: CompanyStatus;
  trialEndsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subscription?: Subscription; // Singular para 1:1 o primera relación
  subscriptions?: Subscription[];
  memberships?: Membership[];
  customers?: Customer[];
  products?: Product[];
  categories?: Category[];
  sales?: Sale[];
  employees?: Employee[];
  invoices?: InvoiceTemplate[];
  notifications?: Notification[];
  auditLogs?: AuditLog[];
  paymentSettings?: PaymentSetting[];
  inventoryMovements?: InventoryMovement[];
  planUpgradeRequests?: PlanUpgradeRequest[];
  checkoutRequests?: CheckoutRequest[];
  _count?: {
    memberships: number;
    customers: number;
    products: number;
    categories: number;
    sales: number;
    employees: number;
  };
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceMonthly: string;
  priceYearly: string;
  billingCycle: BillingCycle;
  maxUsers: number;
  maxProducts: number;
  features: JsonValue;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  subscriptions?: Subscription[];
  _count?: {
    subscriptions: number;
  };
}

export interface Subscription {
  id: string;
  export interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  provider: PaymentProvider;
  billingCycle: BillingCycle;
  startDate: Date;
  endDate?: Date | null;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
  plan?: Plan;
  payments?: Payment[];
  _count?: {
    payments: number;
  };
}

export interface Membership {
  id: string;
  userId: string;
  companyId: string;
  role: MembershipRole;
  isActive: boolean;
  createdAt: Date;
  user?: User;
  company?: Company;
}

export interface Customer {
  id: string;
  companyId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  documentType?: string | null;
  documentValue?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
  sales?: Sale[];
}

export interface Category {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
  products?: Product[];
  _count?: {
    products: number;
  };
}

export interface Product {
  id: string;
  companyId: string;
  categoryId?: string | null;
  name: string;
  sku?: string | null;
  description?: string | null;
  salePrice: string;
  costPrice?: string | null;
  stockQuantity: number;
  minStock: number;
  isActive: boolean;
  imageUrl?: string | null;
  barcode?: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
  category?: Category | null;
  saleItems?: SaleItem[];
  inventoryMovements?: InventoryMovement[];
}

export interface Sale {
  id: string;
  companyId: string;
  customerId?: string | null;
  employeeId?: string | null;
  saleNumber: string;
  status: SaleStatus;
  subtotal: string;
  taxAmount: string;
  discountAmount?: string | null;
  totalAmount: string;
  paymentMethod: PaymentProvider;
  paidAmount: string;
  changeAmount: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
  customer?: Customer | null;
  employee?: Employee | null;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  createdAt: Date;
  sale?: Sale;
  product?: Product;
}

export interface Employee {
  id: string;
  companyId: string;
  userId?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  dni?: string | null;
  role: MembershipRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
  user?: User | null;
  sales?: Sale[];
}

export interface InventoryMovement {
  id: string;
  companyId: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  reference?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: Date;
  company?: Company;
  product?: Product;
}

export interface Payment {
  id: string;
  subscriptionId: string;
  amount: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  currency: string;
  providerPayload?: Record<string, unknown> | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subscription?: Subscription;
}

export interface PlanUpgradeRequest {
  id: string;
  companyId: string;
  planId: string;
  status: PlanUpgradeStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
  plan?: Plan;
}

export interface InvoiceTemplate {
  id: string;
  companyId?: string | null;
  name: string;
  content: string;
  isGlobal: boolean;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  company?: Company | null;
  
  // Campos adicionales de configuracion
  type?: string | null;
  description?: string | null;
  headerText?: string | null;
  logoUrl?: string | null;
  companyRuc?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  showLogo?: boolean;
  showCompany?: boolean;
  showCustomer?: boolean;
  showEmployee?: boolean;
  showItems?: boolean;
  showSubtotal?: boolean;
  showTax?: boolean;
  showDiscount?: boolean;
  showSaleNumber?: boolean;
  showSaleDate?: boolean;
  showSaleTime?: boolean;
  showPaymentMethod?: boolean;
  footerText?: string | null;
  taxPercentage?: number;
  customFields?: Record<string, unknown> | null;
  fontFamily?: string;
  fontSize?: number;
  paperSize?: string;
}

export interface Notification {
  id: string;
  userId: string;
  companyId?: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  sentAt?: Date | null;
  createdAt: Date;
  user?: User;
  company?: Company | null;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  company?: Company;
  user?: User | null;
}

export interface PaymentSetting {
  id: string;
  companyId: string;
  provider: PaymentProvider;
  config: Record<string, unknown>;
  qrImageBase64?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  instructions?: string | null;
  isEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
}

export interface CheckoutRequest {
  id: string;
  companyId?: string | null;
  planId: string;
  fullName: string;
  companyName?: string | null;
  email: string;
  passwordHash: string;
  provider: PaymentProvider;
  amount: string;
  currency: string;
  status: CheckoutRequestStatus;
  proofImageBase64?: string | null;
  reviewNotes?: string | null;
  paymentDate?: Date | null;
  submittedAt?: Date | null;
  userId?: string | null;
  subscriptionId?: string | null;
  notes?: string | null;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: Company | null;
  plan?: Plan;
}

export interface PaymentProof {
  id: string;
  subscriptionId: string;
  imageBase64: string;
  amount: string;
  paymentDate: Date;
  status: ProofStatus;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  subscription?: Subscription;
}

// DTOs
export interface CreateProductDto {
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  costPrice?: number;
  salePrice: number;
  stockQuantity: number;
  minStock?: number;
  categoryId?: string;
  imageUrl?: string;
}

export interface UpdateProductDto extends CreateProductDto {}

export interface CreateCustomerDto {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  documentType?: string;
  documentValue?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export interface CreateEmployeeDto {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dni?: string;
  role: MembershipRole;
  userId?: string;
  isActive?: boolean;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {}

export interface CreateCategoryDto {
  name: string;
  description?: string;
}

export interface UpdateCategoryDto extends CreateCategoryDto {}

export interface CreateSaleDto {
  customerId?: string;
  employeeId?: string;
  paymentMethod: PaymentProvider;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  discountPercent?: number;
  notes?: string;
}

export interface CreateCompanyDto {
  name: string;
  slug?: string;
  legalName?: string;
  taxId?: string;
  address?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  currency?: string;
}

export interface UpdateCompanyDto extends Partial<CreateCompanyDto> {}

export interface RegisterDto {
  fullName: string;
  companyName: string;
  email: string;
  phone?: string;
  password: string;
  planCode?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateInventoryMovementDto {
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  reference?: string;
  reason?: string;
  notes?: string;
}

export interface CreateInvoiceTemplateDto {
  name?: string;
  description?: string;
  type?: string;
  isGlobal?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
  headerText?: string;
  logoUrl?: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
  showLogo?: boolean;
  showCompany?: boolean;
  showCustomer?: boolean;
  showEmployee?: boolean;
  showItems?: boolean;
  showSubtotal?: boolean;
  showTax?: boolean;
  showDiscount?: boolean;
  showSaleNumber?: boolean;
  showSaleDate?: boolean;
  showSaleTime?: boolean;
  showPaymentMethod?: boolean;
  footerText?: string;
  taxPercentage?: number;
  customFields?: Record<string, unknown>;
  fontFamily?: string;
  fontSize?: number;
  paperSize?: string;
}

export interface UpdateInvoiceTemplateDto extends Partial<CreateInvoiceTemplateDto> {}

export interface CreatePaymentProofDto {
  subscriptionId: string;
  imageBase64: string;
  amount: string;
  paymentDate?: Date;
}

export interface ReviewPaymentProofDto {
  status: ProofStatus;
  notes?: string;
}