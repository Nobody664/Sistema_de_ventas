# Comparacion: Prisma Schema vs Frontend Types

## Resumen de Verificacion

| Modelo | Estado |
|--------|--------|
| User | ✅ COINCIDE |
| Company | ✅ COINCIDE |
| Plan | ✅ COINCIDE |
| Subscription | ✅ COINCIDE |
| Membership | ⚠️ FALTA `isActive` |
| Customer | ✅ COINCIDE |
| Category | ✅ COINCIDE |
| Product | ✅ COINCIDE |
| Sale | ✅ COINCIDE |
| SaleItem | ✅ COINCIDE |
| Employee | ✅ COINCIDE |
| InventoryMovement | ✅ COINCIDE |
| Payment | ✅ COINCIDE |
| PlanUpgradeRequest | ✅ COINCIDE |
| InvoiceTemplate | ✅ COINCIDE |
| Notification | ✅ COINCIDE |
| AuditLog | ✅ COINCIDE |
| PaymentSetting | ✅ COINCIDE |
| CheckoutRequest | ⚠️ FALTAN `paymentDate`, `submittedAt` |

---

## Detalle por Modelo

### Membership

**Schema (linea 217-229)**
```prisma
model Membership {
  id        String         @id @default(cuid())
  userId    String         @map("user_id")
  companyId String         @map("company_id")
  role      MembershipRole @default(CASHIER)
  isActive  Boolean        @default(true) @map("is_active")  // ← FALTA EN FRONTEND
  createdAt DateTime       @default(now()) @map("created_at")

  user    User    @relation(...)
  company Company @relation(...)

  @@unique([userId, companyId])
  @@map("memberships")
}
```

**Frontend (types/generated.ts linea 100-108)**
```typescript
export interface Membership {
  id: string;
  userId: string;
  companyId: string;
  role: MembershipRole;
  // isActive: boolean;  // ← NO ESTA
  createdAt: Date;
  user?: User;
  company?: Company;
}
```

**Accion requerida**: Agregar `isActive: boolean` a `types/generated.ts`

---

### CheckoutRequest

**Schema (linea 479-504)**
```prisma
model CheckoutRequest {
  id          String              @id @default(cuid())
  companyId   String?            @map("company_id")
  planId     String              @map("plan_id")
  fullName   String              @map("full_name")
  companyName String?            @map("company_name")
  email      String
  passwordHash String            @map("password_hash")
  provider   PaymentProvider
  amount     String
  currency   String            @default("PEN")
  status     CheckoutRequestStatus @default(DRAFT)
  proofImageBase64 String?       @map("proof_image_base64")
  reviewNotes String?           @map("review_notes")
  paymentDate  DateTime?        @map("payment_date")        // ← FALTA EN FRONTEND
  submittedAt  DateTime?        @map("submitted_at")        // ← FALTA EN FRONTEND
  notes      String?
  reviewedAt DateTime?          @map("reviewed_at")
  reviewedBy String?            @map("reviewed_by")
  createdAt  DateTime           @default(now()) @map("created_at")
  updatedAt  DateTime           @updatedAt @map("updated_at")

  company Company?  @relation(...)
  plan    Plan     @relation(...)

  @@map("checkout_requests")
}
```

**Frontend (types/generated.ts linea 315-336)**
```typescript
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
  // paymentDate?: Date | null;     // ← NO ESTA
  // submittedAt?: Date | null;   // ← NO ESTA
  notes?: string | null;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: Company | null;
  plan?: Plan;
}
```

**Accion requerida**: Agregar `paymentDate` y `submittedAt`

---

## Campos que NO existen en Frontend

### 1. Customer.address
El schema tiene `address String?` pero el frontend `customer-form.tsx` NO tiene campo para capturar la direccion.

**Recomendacion**: Agregar campo de direccion al formulario de cliente.

### 2. Membership.isActive
El schema define `isActive Boolean @default(true)` pero el frontend no lo maneja.

**Recomendacion**: Agregar a types/generated.ts

---

## Enums - Verificacion Completa

### CompanyStatus ✅
```typescript
// Schema: ACTIVE, SUSPENDED, TRIAL, PAST_DUE, INACTIVE
// Frontend: COINCIDE
```

### BillingCycle ✅
```typescript
// Schema: MONTHLY, YEARLY
// Frontend: COINCIDE
```

### SubscriptionStatus ✅
```typescript
// Schema: TRIALING, ACTIVE, PAST_DUE, CANCELED, EXPIRED
// Frontend: COINCIDE
```

### PaymentStatus ✅
```typescript
// Schema: PENDING, SUCCEEDED, FAILED, REFUNDED, CANCELED
// Frontend: COINCIDE
```

### PaymentProvider ✅
```typescript
// Schema: STRIPE, MERCADOPAGO, PAYPAL, CASH, CARD, TRANSFER, YAPE, PLIN
// Frontend: COINCIDE
```

### GlobalRole ✅
```typescript
// Schema: SUPER_ADMIN, ADMIN, USER
// Frontend: COINCIDE
```

### MembershipRole ✅
```typescript
// Schema: COMPANY_ADMIN, MANAGER, CASHIER, VIEWER
// Frontend: COINCIDE
```

### SaleStatus ✅
```typescript
// Schema: COMPLETED, CANCELLED, REFUNDED, PENDING
// Frontend: COINCIDE
```

### NotificationType ✅
```typescript
// Schema: SALE, PAYMENT, INVENTORY, SUBSCRIPTION, SYSTEM
// Frontend: COINCIDE
```

### NotificationChannel ✅
```typescript
// Schema: EMAIL, IN_APP, SMS, WHATSAPP
// Frontend: COINCIDE
```

### PlanUpgradeStatus ✅
```typescript
// Schema: PENDING, APPROVED, REJECTED
// Frontend: COINCIDE
```

### CheckoutRequestStatus ✅
```typescript
// Schema: DRAFT, SUBMITTED, REVIEWING, APPROVED, REJECTED, CANCELLED
// Frontend: COINCIDE
```

### AuditAction ✅
```typescript
// Schema: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT
// Frontend: COINCIDE
```

### InventoryMovementType ✅
```typescript
// Schema: IN, OUT, ADJUSTMENT
// Frontend: COINCIDE
```

---

## Campos Decimal (Prisma) vs String (Frontend)

Los campos `Decimal` de Prisma se convierten a `string` en TypeScript:

| Modelo | Campo | Prisma | TypeScript |
|--------|-------|--------|------------|
| Plan | priceMonthly | Decimal | string |
| Plan | priceYearly | Decimal | string |
| Product | salePrice | Decimal | string |
| Product | costPrice | Decimal? | string \| null |
| Sale | subtotal | Decimal | string |
| Sale | taxAmount | Decimal | string |
| Sale | discountAmount | Decimal? | string \| null |
| Sale | totalAmount | Decimal | string |
| Sale | paidAmount | Decimal | string |
| Sale | changeAmount | Decimal | string |
| SaleItem | unitPrice | Decimal | string |
| SaleItem | totalPrice | Decimal | string |
| Payment | amount | Decimal | string |

**Nota**: Esto es intencional para evitar problemas de precision en JSON.

---

## Relaciones en Frontend (Opcionales)

Los tipos del frontend incluyen relaciones opcionales para facilitar el uso:

```typescript
interface Product {
  // ... campos propios
  company?: Company;
  category?: Category | null;
  saleItems?: SaleItem[];
  inventoryMovements?: InventoryMovement[];
}
```

Esto NO esta en el schema de Prisma pero se genera automaticamente con `@prisma generate --output`.

---

## Acciones Requeridas

1. ~~**Agregar `isActive` a Membership** en `types/generated.ts`~~ ✅ CORREGIDO
2. ~~**Agregar `paymentDate` y `submittedAt` a CheckoutRequest** en `types/generated.ts`~~ ✅ CORREGIDO
3. **Considerar agregar `address` a customer-form.tsx** (no critico, campo opcional)

---

## Estado Final

| Modelo | Estado |
|--------|--------|
| User | ✅ |
| Company | ✅ |
| Plan | ✅ |
| Subscription | ✅ |
| Membership | ✅ CORREGIDO |
| Customer | ✅ |
| Category | ✅ |
| Product | ✅ |
| Sale | ✅ |
| SaleItem | ✅ |
| Employee | ✅ |
| InventoryMovement | ✅ |
| Payment | ✅ |
| PlanUpgradeRequest | ✅ |
| InvoiceTemplate | ✅ |
| Notification | ✅ |
| AuditLog | ✅ |
| PaymentSetting | ✅ |
| CheckoutRequest | ✅ CORREGIDO |