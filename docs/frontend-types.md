# Tipos de Modelos - Frontend

Este documento mapea los modelos de la base de datos (Prisma) con los tipos TypeScript utilizados en el frontend.

---

## Enums

### CompanyStatus
```typescript
type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PAST_DUE' | 'INACTIVE';
```

### BillingCycle
```typescript
type BillingCycle = 'MONTHLY' | 'YEARLY';
```

### SubscriptionStatus
```typescript
type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
```

### PaymentStatus
```typescript
type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELED';
```

### PaymentProvider
```typescript
type PaymentProvider = 'STRIPE' | 'MERCADOPAGO' | 'PAYPAL' | 'CASH' | 'CARD' | 'TRANSFER' | 'YAPE' | 'PLIN';
```

### GlobalRole
```typescript
type GlobalRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
```

### MembershipRole
```typescript
type MembershipRole = 'COMPANY_ADMIN' | 'MANAGER' | 'CASHIER' | 'VIEWER';
```

### SaleStatus
```typescript
type SaleStatus = 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PENDING';
```

### NotificationType
```typescript
type NotificationType = 'SALE' | 'PAYMENT' | 'INVENTORY' | 'SUBSCRIPTION' | 'SYSTEM';
```

### NotificationChannel
```typescript
type NotificationChannel = 'EMAIL' | 'IN_APP' | 'SMS' | 'WHATSAPP';
```

### PlanUpgradeStatus
```typescript
type PlanUpgradeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
```

### CheckoutRequestStatus
```typescript
type CheckoutRequestStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
```

### AuditAction
```typescript
type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT';
```

### InventoryMovementType
```typescript
type InventoryMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';
```

---

## Modelos

### User
```typescript
interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  globalRole: GlobalRole;
  createdAt: Date;
  updatedAt: Date;
}
```

### Company
```typescript
interface Company {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  timezone: string;        // default: 'America/Lima'
  currency: string;       // default: 'PEN'
  status: CompanyStatus;  // default: 'TRIAL'
  trialEndsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Plan
```typescript
interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceMonthly: Decimal;  // @db.Decimal(10, 2)
  priceYearly: Decimal;    // @db.Decimal(10, 2)
  billingCycle: BillingCycle;
  maxUsers: number;        // default: 1
  maxProducts: number;     // default: 100
  features?: Prisma.JsonValue | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Subscription
```typescript
interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  provider: PaymentProvider;
  billingCycle: BillingCycle;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Membership
```typescript
interface Membership {
  id: string;
  userId: string;
  companyId: string;
  role: MembershipRole;
  createdAt: Date;
}
```

### Customer
```typescript
interface Customer {
  id: string;
  companyId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  documentType?: string | null;   // 'DNI' | 'RUC' | 'PASSPORT'
  documentValue?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Category
```typescript
interface Category {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Product
```typescript
interface Product {
  id: string;
  companyId: string;
  categoryId?: string | null;
  name: string;
  sku?: string | null;
  description?: string | null;
  salePrice: Decimal;      // @db.Decimal(10, 2)
  costPrice?: Decimal | null;  // @db.Decimal(10, 2)
  stockQuantity: number;    // default: 0
  minStock: number;        // default: 5
  isActive: boolean;
  imageUrl?: string | null;
  barcode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Sale
```typescript
interface Sale {
  id: string;
  companyId: string;
  customerId?: string | null;
  employeeId?: string | null;
  saleNumber: string;      // unique
  status: SaleStatus;
  subtotal: Decimal;       // @db.Decimal(12, 2)
  taxAmount: Decimal;      // @db.Decimal(12, 2)
  discountAmount?: Decimal | null;  // @db.Decimal(12, 2)
  totalAmount: Decimal;    // @db.Decimal(12, 2)
  paymentMethod: PaymentProvider;
  paidAmount: Decimal;    // @db.Decimal(12, 2)
  changeAmount: Decimal;   // @db.Decimal(12, 2)
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### SaleItem
```typescript
interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: Decimal;      // @db.Decimal(12, 2)
  totalPrice: Decimal;     // @db.Decimal(12, 2)
  createdAt: Date;
}
```

### Employee
```typescript
interface Employee {
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
}
```

### InventoryMovement
```typescript
interface InventoryMovement {
  id: string;
  companyId: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  reference?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: Date;
}
```

### Payment
```typescript
interface Payment {
  id: string;
  subscriptionId: string;
  amount: Decimal;         // @db.Decimal(10, 2)
  status: PaymentStatus;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  currency: string;       // default: 'PEN'
  providerPayload?: Prisma.JsonValue | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### PlanUpgradeRequest
```typescript
interface PlanUpgradeRequest {
  id: string;
  companyId: string;
  planId: string;
  status: PlanUpgradeStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### InvoiceTemplate
```typescript
interface InvoiceTemplate {
  id: string;
  companyId?: string | null;
  name: string;
  content: string;        // @db.Text
  isGlobal: boolean;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Notification
```typescript
interface Notification {
  id: string;
  userId: string;
  companyId?: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Prisma.JsonValue | null;
  isRead: boolean;
  sentAt?: Date | null;
  createdAt: Date;
}
```

### AuditLog
```typescript
interface AuditLog {
  id: string;
  companyId: string;
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  changes?: Prisma.JsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}
```

### PaymentSetting
```typescript
interface PaymentSetting {
  id: string;
  companyId: string;
  provider: PaymentProvider;
  config: Prisma.JsonValue;
  qrImageBase64?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  instructions?: string | null;
  isEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### CheckoutRequest
```typescript
interface CheckoutRequest {
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
  notes?: string | null;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## DTOs del Frontend

### CreateProductDto
```typescript
interface CreateProductDto {
  name: string;           // required, max 100
  sku?: string;           // optional, max 50
  barcode?: string;       // optional, max 50
  description?: string;   // optional, max 500
  costPrice: number;      // >= 0
  salePrice: number;      // >= 0
  stockQuantity: number;  // >= 0
  minStock: number;       // >= 0
  categoryId?: string;
  imageUrl?: string;
}
```

### CreateCustomerDto
```typescript
interface CreateCustomerDto {
  firstName: string;      // required, max 100
  lastName: string;       // required, max 100
  email?: string;         // valid email, optional
  phone?: string;         // 9-15 chars, optional
  documentType: 'DNI' | 'RUC' | 'PASSPORT';
  documentNumber: string; // 8 (DNI), 11 (RUC), 6-20 (PASSPORT)
  notes?: string;        // optional, max 500
}
```

### CreateEmployeeDto
```typescript
interface CreateEmployeeDto {
  firstName: string;      // required, max 100
  lastName: string;       // required, max 100
  email: string;          // valid email, required
  phone?: string;         // 9-15 chars, optional
  dni: string;            // exactly 8 digits
  role: 'MANAGER' | 'CASHIER' | 'SUPPORT';
  isActive: boolean;
}
```

### CreateCategoryDto
```typescript
interface CreateCategoryDto {
  name: string;           // required, max 100
  description?: string;  // optional, max 255
}
```

### CreateSaleDto
```typescript
interface CreateSaleDto {
  customerId?: string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
  items: Array<{
    productId: string;
    quantity: number;    // >= 1
  }>;
  discountPercent: number; // 0-100
  notes?: string;
}
```

---

## Notas Importantes

1. **Decimal**: Los campos Decimal de Prisma se manejan como strings en el frontend para evitar problemas de precisión.

2. **Fechas**: Usar `Date` en TypeScript, el API retorna fechas ISO string.

3. **Enums personalizados**: `MembershipRole` en Prisma tiene `COMPANY_ADMIN`, `MANAGER`, `CASHIER`, `VIEWER` - pero el formulario de empleados usa `SUPPORT` que no existe en el schema.

4. **PaymentProvider**: El frontend actualmente solo soporta `CASH`, `CARD`, `TRANSFER` en ventas, pero el schema incluye `STRIPE`, `MERCADOPAGO`, `PAYPAL`, `YAPE`, `PLIN`.