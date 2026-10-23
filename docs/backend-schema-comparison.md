# Reporte: Comparacion Backend vs Prisma Schema

## Resumen de Modulos

| Modulo | Service | Controller | DTO | Estado |
|--------|---------|------------|-----|--------|
| auth | ✅ | ✅ | ✅ | OK |
| companies | ✅ | ✅ | ✅ | OK |
| customers | ✅ | ✅ | ✅ | OK |
| products | ✅ | ✅ | ✅ | OK |
| categories | ✅ | ✅ | ✅ | OK |
| employees | ✅ | ✅ | ✅ | OK |
| sales | ✅ | ✅ | ✅ | OK |
| inventory | ✅ | ✅ | ✅ | OK |
| plans | ✅ | ✅ | ✅ | OK |
| subscriptions | ✅ | ✅ | ⚠️ | FALTA DTO |
| payments | ✅ | ✅ | ✅ | OK |
| checkout-requests | ✅ | ✅ | ✅ | OK |
| payment-settings | ✅ | ✅ | ✅ | OK |
| notifications | ✅ | ✅ | N/A | OK |
| invoices | ✅ | ✅ | ✅ | OK |
| users | ✅ | N/A | N/A | OK |
| reports | ✅ | ✅ | N/A | OK |
| dashboard | ✅ | ✅ | N/A | OK |
| audit | ✅ | ✅ | N/A | OK |

---

## Discrepancias Encontradas

### 1. Products Service - Campo incorrecto

**Archivo**: `modules/products/products.service.ts:266`

```typescript
// INCORRECTO
const products = await this.prisma.product.findMany({
  where: {
    companyId,
    status: 'ACTIVE',  // ❌ No existe en schema
  },
  // ...
});
```

**Schema**: El modelo `Product` NO tiene campo `status`, tiene `isActive: Boolean`

**Correccion**: Cambiar `status: 'ACTIVE'` por `isActive: true`

---

### 2. Products Service - Export usa campo inexistente

**Archivo**: `modules/products/products.service.ts:316`

```typescript
// INCORRECTO
const rows = products.map((p) => [
  // ...
  String(p.price),  // ❌ No existe, debe ser p.salePrice
  // ...
]);
```

**Correccion**: Cambiar `p.price` por `p.salePrice`

---

### 3. Products DTO - Faltan campos de SKU

**Archivo**: `modules/products/dto/product.dto.ts`

El DTO no incluye validacion para `sku` como obligatorio en creacion, pero el service puede generar uno automaticamente.

**Estado**: Aceptable - el service genera SKU automaticamente

---

### 4. Sales DTO - Status incorrecto para export

**Archivo**: `modules/sales/dto/sale.dto.ts:57`

```typescript
// INCORRECTO
@IsOptional()
@IsIn(['COMPLETED', 'VOIDED', 'REFUNDED'])
status?: 'COMPLETED' | 'VOIDED' | 'REFUNDED';  // ❌ VOIDED no existe
```

**Schema**: `SaleStatus` define `COMPLETED | CANCELLED | REFUNDED | PENDING`

**Correccion**: Cambiar `VOIDED` por `CANCELLED`

---

### 5. Sales Service - Campo incorrecto en producto

**Archivo**: `modules/sales/sales.service.ts:193,208`

```typescript
const products = (await this.prisma.product.findMany({
  where: {
    companyId,
    id: { in: input.items.map((item) => item.productId) },
  },
})) as Array<{ id: string; stockQuantity: number; name: string; price: unknown }>;
//                                                                ^^^^^ No existe
```

**Correccion**: Cambiar `price` por `salePrice`

---

### 6. Inventory DTO - Falta tipo de movimiento

**Archivo**: `modules/inventory/dto/inventory.dto.ts`

```typescript
export class CreateInventoryAdjustmentDto {
  @IsString()
  productId!: string;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;
  // ❌ Falta campo 'type' que usa el service
}
```

**Service usa**: `type: 'ADJUSTMENT'` pero no viene del DTO

**Estado**: Aceptable - el tipo se hardcodea en el service

---

### 7. Customer DTO - Falta campo address

**Archivo**: `modules/customers/dto/customer.dto.ts`

El schema tiene `address String?` pero el DTO no lo incluye.

```typescript
export class CreateCustomerDto {
  // ... campos existentes
  // ❌ Falta: address?: string;
}
```

**Nota**: El frontend tampoco tiene campo address

---

### 8. PaymentSettings Service - Modelo inexistente

**Archivo**: `modules/payments/payment-settings.service.ts:60-68`

```typescript
return this.prisma.paymentProof.create({
  data: {
    subscriptionId,
    imageBase64: data.imageBase64,
    // ...
  },
});
```

El codigo usa `paymentProof` pero en el schema NO existe el modelo `PaymentProof`.

**Estado**: ❌ ERROR - El modelo `PaymentProof` no esta definido en schema.prisma

---

### 9. PaymentSettings DTO - Referencia a ProofStatus

**Archivo**: `modules/payments/pto/payment-settings.dto.ts`

```typescript
import { PaymentProvider, ProofStatus } from '@prisma/client';
//                        ^^^^^^^^^^^^^
//                        NO EXISTE EN SCHEMA
```

**Estado**: ❌ ERROR - El enum `ProofStatus` no existe en schema.prisma

---

### 10. Notifications - Enum diferente

**Archivo**: `modules/notifications/notifications.service.ts`

El servicio define sus propios enums pero usa casting `as any`:

```typescript
type: input.type as any,
channel: (input.channel || NotificationChannel.IN_APP) as any,
```

**Schema**: Los enums reales son `NotificationType` y `NotificationChannel`

**Problema**: El servicio usa valores que no existen en el schema:
- `LOW_STOCK` → no existe en schema
- `NEW_SALE` → no existe en schema
- `PAYMENT_RECEIVED` → no existe en schema
- etc.

---

### 11. CheckoutRequests Service - Campos extras

**Archivo**: `modules/payments/checkout-requests.service.ts:487`

```typescript
await tx.checkoutRequest.update({
  where: { id: request.id },
  data: {
    // ...
    userId: user.id,           // ⚠️ Campo no en schema
    subscriptionId: subscription.id,  // ⚠️ Campo no en schema
  },
});
```

El schema de `CheckoutRequest` NO tiene `userId` ni `subscriptionId`.

---

### 12. Subscriptions DTO - No existe

**Archivo**: `modules/subscriptions/dto/`

No existe directorio DTO para subscriptions.

**Estado**: Aceptable - el servicio usa queries directas

---

## Modelos Sin Modulo

Los siguientes modelos del schema NO tienen modulo/servicio dedicado:

| Modelo | Estado |
|--------|--------|
| User | ✅ users.service.ts |
| Membership | ⚠️ Solo usado indirectamente |
| AuditLog | ✅ audit.service.ts |
| PlanUpgradeRequest | ✅ plan-upgrade-requests.service.ts |

---

## Estado Final - Correcciones Aplicadas

### ✅ Aplicadas

1. ✅ **Products Service** - Cambiado `status: 'ACTIVE'` por `isActive: true`
2. ✅ **Products Service Export** - Cambiado `price` por `salePrice` en todos los metodos (csv, excel, pdf)
3. ✅ **Sales Service** - Cambiado `price` por `salePrice` en createSale
4. ✅ **Sales DTO** - Cambiado `VOIDED` por `CANCELLED` y agregado `PENDING`
5. ✅ **Customer DTO** - Agregado campo `address`
6. ✅ **Frontend Types** - Corregido `Membership.isActive` y `CheckoutRequest.paymentDate/submittedAt`
7. ✅ **Frontend Validation** - Cambiado `SUPPORT` por `VIEWER` en employee validation

### ⚠️ Pendientes de Revision (requieren cambios en schema)

1. **PaymentProof modelo** - No existe en schema.prisma, el servicio payment-settings lo usa
2. **ProofStatus enum** - No existe en schema.prisma
3. **CheckoutRequest campos** - Falta `userId` y `subscriptionId`
4. **NotificationType valores** - El servicio usa valores que no existen en el schema

### Archivos Modificados

- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/sales/sales.service.ts`
- `backend/src/modules/sales/dto/sale.dto.ts`
- `backend/src/modules/customers/dto/customer.dto.ts`
- `frontend/types/generated.ts`
- `frontend/types/api.ts`
- `frontend/lib/validations/employee.validation.ts`
- `frontend/components/employees/employee-form.tsx`

---

## Archivos Revisados

- `backend/src/modules/companies/companies.service.ts` ✅
- `backend/src/modules/companies/dto/company.dto.ts` ✅
- `backend/src/modules/products/products.service.ts` ⚠️
- `backend/src/modules/products/dto/product.dto.ts` ✅
- `backend/src/modules/customers/customers.service.ts` ✅
- `backend/src/modules/customers/dto/customer.dto.ts` ⚠️
- `backend/src/modules/employees/employees.service.ts` ✅
- `backend/src/modules/employees/dto/employee.dto.ts` ✅
- `backend/src/modules/sales/sales.service.ts` ⚠️
- `backend/src/modules/sales/dto/sale.dto.ts` ⚠️
- `backend/src/modules/inventory/inventory.service.ts` ✅
- `backend/src/modules/inventory/dto/inventory.dto.ts` ✅
- `backend/src/modules/plans/plans.service.ts` ✅
- `backend/src/modules/plans/dto/plan.dto.ts` ✅
- `backend/src/modules/subscriptions/subscriptions.service.ts` ✅
- `backend/src/modules/payments/payments.service.ts` ✅
- `backend/src/modules/payments/payment-settings.service.ts` ❌
- `backend/src/modules/payments/checkout-requests.service.ts` ⚠️
- `backend/src/modules/payments/dto/payment-settings.dto.ts` ❌
- `backend/src/modules/notifications/notifications.service.ts` ⚠️
- `backend/src/modules/invoices/invoices.service.ts` ✅
- `backend/src/modules/auth/auth.service.ts` ✅
- `backend/src/modules/auth/dto/auth.dto.ts` ✅