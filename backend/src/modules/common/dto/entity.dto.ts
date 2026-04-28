import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStatus, GlobalRole, BillingCycle } from '@prisma/client';

export class UserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: GlobalRole })
  globalRole: GlobalRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  _count?: {
    memberships: number;
  };
}

export class CompanyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  legalName?: string;

  @ApiPropertyOptional()
  taxId?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty()
  timezone: string;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: CompanyStatus })
  status: CompanyStatus;

  @ApiPropertyOptional()
  trialEndsAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  _count?: {
    memberships: number;
    customers: number;
    products: number;
    categories: number;
    sales: number;
    employees: number;
  };
}

export class PlanDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  priceMonthly: string;

  @ApiProperty()
  priceYearly: string;

  @ApiProperty({ enum: BillingCycle })
  billingCycle: BillingCycle;

  @ApiProperty()
  maxUsers: number;

  @ApiProperty()
  maxProducts: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  _count?: {
    subscriptions: number;
  };
}

export class CategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  _count?: {
    products: number;
  };
}

export class ProductDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiPropertyOptional()
  categoryId?: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  sku?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  salePrice: string;

  @ApiPropertyOptional()
  costPrice?: string;

  @ApiProperty()
  stockQuantity: number;

  @ApiProperty()
  minStock: number;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  barcode?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CustomerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  documentType?: string;

  @ApiPropertyOptional()
  documentValue?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class EmployeeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER'] })
  role: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SaleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SubscriptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  planId: string;

  @ApiProperty({ enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] })
  status: string;

  @ApiProperty({ enum: BillingCycle })
  billingCycle: BillingCycle;

  @ApiProperty()
  startDate: Date;

  @ApiPropertyOptional()
  endDate?: Date;

  @ApiProperty()
  autoRenew: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class MembershipDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty({ enum: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER'] })
  role: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class NotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  companyId?: string;

  @ApiProperty({ enum: ['SALE', 'PAYMENT', 'INVENTORY', 'SUBSCRIPTION', 'SYSTEM'] })
  type: string;

  @ApiProperty({ enum: ['EMAIL', 'IN_APP', 'SMS', 'WHATSAPP'] })
  channel: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  isRead: boolean;

  @ApiPropertyOptional()
  readAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class PaymentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  subscriptionId: string;

  @ApiProperty({ enum: ['STRIPE', 'MERCADOPAGO', 'PAYPAL', 'CASH', 'CARD', 'TRANSFER', 'YAPE', 'PLIN'] })
  provider: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELED'] })
  status: string;

  @ApiProperty()
  createdAt: Date;
}