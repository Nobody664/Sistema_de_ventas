# Problemas de Tipos Identificados

## Resumen de Discrepancias

Después de revisar el frontend y comparar con el schema de Prisma, se encontraron las siguientes discrepancias:

---

## 1. Employee.role

**Problema**: El frontend usa `SUPPORT` pero el schema define `VIEWER`

### Schema (Prisma)
```prisma
enum MembershipRole {
  COMPANY_ADMIN
  MANAGER
  CASHIER
  VIEWER
}
```

### Frontend (employee-form.tsx:256-259)
```tsx
<option value="MANAGER">Gerente</option>
<option value="CASHIER">Cajero</option>
<option value="SUPPORT">Soporte</option>  // ❌ No existe en enum
```

### employee.validation.ts:9
```typescript
role: z.enum(['MANAGER', 'CASHIER', 'SUPPORT']).default('CASHIER'),
```

**Solución**: Cambiar `SUPPORT` a `VIEWER`

---

## 2. Sale.paymentMethod

**Problema**: El frontend solo soporta `CASH`, `CARD`, `TRANSFER` pero el schema incluye más opciones

### Schema
```prisma
enum PaymentProvider {
  STRIPE
  MERCADOPAGO
  PAYPAL
  CASH
  CARD
  TRANSFER
  YAPE
  PLIN
}
```

### Frontend (sale-form.tsx:49)
```typescript
const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
```

**Nota**: Esto es intencional para el POS, pero debería ser consistente.

---

## 3. CreateCustomerDto vs Schema

**Problema**: El frontend envía `documentNumber` pero el schema espera `documentValue`

### Frontend (customer-form.tsx:52-63)
```typescript
const data = {
  firstName: formData.get('firstName') as string,
  lastName: formData.get('lastName') as string,
  email: (formData.get('email') as string) || undefined,
  phone: (formData.get('phone') as string) || undefined,
  documentType: documentType,
  documentNumber: formData.get('documentNumber') as string,  // ❌ Campo diferente
  notes: (formData.get('notes') as string) || undefined,
};

const payload = {
  firstName: data.firstName,
  lastName: data.lastName,
  email: data.email,
  phone: data.phone,
  documentType: data.documentType,
  documentValue: data.documentNumber,  // ✅ Mapeo correcto
  notes: data.notes,
};
```

**Estado**: ✅ Correcto - Hay un mapeo intermedio

---

## 4. Customer.address

**Problema**: El schema tiene `address` pero el frontend no lo utiliza

### Schema
```prisma
model Customer {
  address String?
}
```

### Frontend (customer-form.tsx)
No existe campo para `address` en el formulario.

---

## 5. Product Decimal Fields

**Problema**: Los campos Decimal se envían como `string` desde el frontend

### Frontend (product-form.tsx:73-76)
```typescript
const data = {
  // ...
  costPrice: parseFloat(formData.get('costPrice') as string) || 0,  // number
  salePrice: parseFloat(formData.get('salePrice') as string) || 0,  // number
  // ...
};
```

### Schema
```prisma
salePrice     Decimal  @map("sale_price") @db.Decimal(10, 2)
costPrice     Decimal? @map("cost_price") @db.Decimal(10, 2)
```

**Nota**: Prisma maneja `Decimal` con la librería `decimal.js`. El backend debería convertir de string a Decimal.

---

## 6. SignUp Payload

**Problema**: El sign-up form envía `companyName` pero el schema requiere `name`

### Frontend (sign-up-form.tsx:73-80)
```typescript
body: JSON.stringify({
  fullName: values.fullName,
  companyName: values.companyName,  // ❌ Campo diferente
  email: values.email,
  phone: values.phone || undefined,
  password: values.password,
  planCode: values.planCode,
}),
```

### Schema (Company)
```prisma
model Company {
  name String
}
```

**Solución**: El backend debe mapear `companyName` a `name` o el frontend debe enviar `name`.

---

## 7. CheckoutRequest Schema

**Problema**: El schema incluye `passwordHash` pero esto no debería enviarse desde el frontend

### Schema
```prisma
model CheckoutRequest {
  passwordHash String @map("password_hash")
  // ...
}
```

**Nota**: Por seguridad, la contraseña no debería viajar en texto plano ni en un checkout request. Considerar usar un token de verificación.

---

## 8. Employee sin validación de userId

**Problema**: El schema permite `userId` pero el frontend no lo maneja

### Schema
```prisma
model Employee {
  userId String? @unique @map("user_id")
}
```

### Frontend
No existe campo para asociar un usuario existente al empleado.

---

## Recomendaciones

1. **Generar tipos desde Prisma**: Usar `prisma generate` para generar tipos automáticamente
2. **Crear DTOs centralizados**: Mover los DTOs a `types/` para reutilizarlos
3. **Validar en backend**: No confiar solo en validaciones del frontend
4. **Decimal handling**: Considerar usar bibliotecas como `decimal.js` en el frontend para precisión

---

## Archivos de Tipos Actuales

### types/api.ts
```typescript
import { Product, Customer, Sale, Company, Subscription, Plan, Category, Employee, Notification, PaymentSetting } from '@/types/generated';

export type Product = Omit<Product, 'costPrice' | 'salePrice'> & {
  costPrice: string;
  salePrice: string;
};
```

**Nota**: Depende de `@/types/generated` que debería generarse con Prisma.

---

## Comandos para Sincronizar

```bash
# Generar tipos desde Prisma
cd backend
npx prisma generate

# Los tipos se generan en @prisma/client
```

---

## Validityions mapping

| Schema Field | Frontend Field | Validation |
|--------------|----------------|------------|
| name | name | required, max 100 |
| sku | sku | optional, max 50 |
| barcode | barcode | optional, max 50 |
| description | description | optional, max 500 |
| salePrice | salePrice | required, >= 0 |
| costPrice | costPrice | optional, >= 0 |
| stockQuantity | stockQuantity | required, >= 0 |
| minStock | minStock | optional, >= 0 (default: 5) |
| categoryId | categoryId | optional |
| imageUrl | imageUrl | optional (base64) |

| Schema Field | Frontend Field | Validation |
|--------------|----------------|------------|
| firstName | firstName | required, max 100 |
| lastName | lastName | required, max 100 |
| email | email | optional, valid email |
| phone | phone | optional, 9-15 chars |
| documentType | documentType | enum: DNI, RUC, PASSPORT |
| documentValue | documentNumber | 8 (DNI), 11 (RUC), 6-20 (PASSPORT) |
| notes | notes | optional, max 500 |
| address | - | NOT IMPLEMENTED |

| Schema Field | Frontend Field | Validation |
|--------------|----------------|------------|
| firstName | firstName | required, max 100 |
| lastName | lastName | required, max 100 |
| email | email | required, valid email |
| phone | phone | optional, 9-15 chars |
| dni | dni | required, exactly 8 digits |
| role | role | enum: MANAGER, CASHIER, VIEWER (❌ SUPPORT actualmente) |
| isActive | isActive | boolean |

| Schema Field | Frontend Field | Validation |
|--------------|----------------|------------|
| name | name | required, max 100 |
| description | description | optional, max 255 |