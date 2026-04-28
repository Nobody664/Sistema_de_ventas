import {
  UserDto,
  CompanyDto,
  PlanDto,
  CategoryDto,
  ProductDto,
  CustomerDto,
  EmployeeDto,
  SaleDto,
  SubscriptionDto,
  MembershipDto,
  NotificationDto,
  PaymentDto,
} from './entity.dto';

export function mapUserToDto(user: any): UserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    globalRole: user.globalRole,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    _count: user._count
      ? {
          memberships: user._count.memberships,
        }
      : undefined,
  };
}

export function mapCompanyToDto(company: any): CompanyDto {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    legalName: company.legalName,
    taxId: company.taxId,
    address: company.address,
    email: company.email,
    phone: company.phone,
    timezone: company.timezone,
    currency: company.currency,
    status: company.status,
    trialEndsAt: company.trialEndsAt,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    _count: company._count
      ? {
          memberships: company._count.memberships,
          customers: company._count.customers,
          products: company._count.products,
          categories: company._count.categories,
          sales: company._count.sales,
          employees: company._count.employees,
        }
      : undefined,
  };
}

export function mapPlanToDto(plan: any): PlanDto {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    billingCycle: plan.billingCycle,
    maxUsers: plan.maxUsers,
    maxProducts: plan.maxProducts,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    _count: plan._count
      ? {
          subscriptions: plan._count.subscriptions,
        }
      : undefined,
  };
}

export function mapCategoryToDto(category: any): CategoryDto {
  return {
    id: category.id,
    companyId: category.companyId,
    name: category.name,
    slug: category.slug,
    description: category.description,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    _count: category._count
      ? {
          products: category._count.products,
        }
      : undefined,
  };
}

export function mapProductToDto(product: any): ProductDto {
  return {
    id: product.id,
    companyId: product.companyId,
    categoryId: product.categoryId,
    name: product.name,
    sku: product.sku,
    description: product.description,
    salePrice: product.salePrice,
    costPrice: product.costPrice,
    stockQuantity: product.stockQuantity,
    minStock: product.minStock,
    isActive: product.isActive,
    imageUrl: product.imageUrl,
    barcode: product.barcode,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function mapCustomerToDto(customer: any): CustomerDto {
  return {
    id: customer.id,
    companyId: customer.companyId,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    documentType: customer.documentType,
    documentValue: customer.documentValue,
    address: customer.address,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export function mapEmployeeToDto(employee: any): EmployeeDto {
  return {
    id: employee.id,
    companyId: employee.companyId,
    userId: employee.userId,
    role: employee.role,
    isActive: employee.isActive,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

export function mapSaleToDto(sale: any): SaleDto {
  return {
    id: sale.id,
    companyId: sale.companyId,
    customerId: sale.customerId,
    status: sale.status,
    totalAmount: sale.totalAmount,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

export function mapSubscriptionToDto(subscription: any): SubscriptionDto {
  return {
    id: subscription.id,
    companyId: subscription.companyId,
    planId: subscription.planId,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    autoRenew: subscription.autoRenew,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

export function mapMembershipToDto(membership: any): MembershipDto {
  return {
    id: membership.id,
    userId: membership.userId,
    companyId: membership.companyId,
    role: membership.role,
    isActive: membership.isActive,
    createdAt: membership.createdAt,
  };
}

export function mapNotificationToDto(notification: any): NotificationDto {
  return {
    id: notification.id,
    userId: notification.userId,
    companyId: notification.companyId,
    type: notification.type,
    channel: notification.channel,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

export function mapPaymentToDto(payment: any): PaymentDto {
  return {
    id: payment.id,
    subscriptionId: payment.subscriptionId,
    provider: payment.provider,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    createdAt: payment.createdAt,
  };
}