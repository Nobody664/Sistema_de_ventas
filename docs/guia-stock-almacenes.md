# Guía de Inventario, Stock y Almacenes

## Estado Actual del Sistema

| Componente | Estado | Archivo |
|-----------|--------|---------|
| `InventoryMovement` (modelo Prisma) | ✅ Implementado | `schema.prisma:376` |
| `inventory.service.ts` | ✅ Implementado | `backend/src/modules/inventory/inventory.service.ts` |
| `GET /inventory/movements` | ✅ Implementado | `inventory.controller.ts:18` |
| `GET /inventory/low-stock` | ✅ Implementado | `inventory.controller.ts:25` |
| `POST /inventory/adjustments` | ✅ Implementado | `inventory.controller.ts:32` |
| Stock en `Product.stockQuantity` | ✅ Implementado | `schema.prisma:292` |
| Movimiento en ventas (Sale → InventoryMovement) | ✅ Implementado | `sales.service.ts:266` |
| Dashboard con métricas de inventario | ✅ Implementado | `dashboard.service.ts` |
| Módulo de lotes (`ProductBatch`) | ❌ No implementado | — |
| Módulo de sucursales (`Branch`) | ❌ No implementado | — |
| Kardex valorizado | ❌ No implementado | Ver `docs/kardes-valorizado.md` |
| Alertas de vencimiento | ❌ No implementado | — |
| Reposición automática | ❌ No implementado | — |

---

## Arquitectura Actual del Módulo de Inventario

```
backend/src/modules/inventory/
├── dto/
│   └── inventory.dto.ts           # CreateInventoryAdjustmentDto
├── inventory.controller.ts        # 3 endpoints REST
├── inventory.module.ts            # Importa PrismaModule
└── inventory.service.ts           # Lógica: findLowStock, findMovements, adjustStock
```

### Guards Pipeline

```
JwtAuthGuard → TenantGuard → PermissionsGuard
    │              │              │
   JWT           companyId     @Permissions(INVENTORY_VIEW)
   válido        inyectado     o INVENTORY_ADJUST
```

### Endpoints Actuales

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| `GET` | `/inventory/movements` | `INVENTORY_VIEW` | Últimos 50 movimientos con producto incluido |
| `GET` | `/inventory/low-stock` | `INVENTORY_VIEW` | Productos con stock ≤ 10 |
| `POST` | `/inventory/adjustments` | `INVENTORY_ADJUST` | Crear ajuste manual de stock |

### Roles con Acceso a Inventario

| Rol | INVENTORY_VIEW | INVENTORY_INBOUND | INVENTORY_OUTBOUND | INVENTORY_ADJUST |
|-----|:---:|:---:|:---:|:---:|
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ |
| COMPANY_ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ✅ | ❌ |
| CASHIER | ❌ | ❌ | ❌ | ❌ |
| VIEWER | ❌ | ❌ | ❌ | ❌ |

---

## Modelos de Datos (Prisma)

### Product (schema.prisma:283)

```prisma
model Product {
  id            String    @id @default(cuid())
  companyId     String    @map("company_id")
  categoryId    String?   @map("category_id")
  name          String
  sku           String?   @unique
  description   String?
  salePrice     Decimal   @map("sale_price")
  costPrice     Decimal?  @map("cost_price")
  stockQuantity Int       @default(0) @map("stock_quantity")
  minStock      Int       @default(5) @map("min_stock")
  isActive      Boolean   @default(true) @map("is_active")
  imageUrl      String?   @map("image_url")
  barcode       String?   @unique
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  company            Company             @relation(fields: [companyId], references: [id])
  category           Category?           @relation(fields: [categoryId], references: [id])
  saleItems          SaleItem[]
  inventoryMovements InventoryMovement[]
}
```

**Nota**: `stockQuantity` se actualiza directamente en `Product`. Esto es un campo calculado derivado de los movimientos, pero actualmente se maneja como valor directo (no como agregación de `InventoryMovement`).

### InventoryMovement (schema.prisma:376)

```prisma
enum InventoryMovementType {
  IN
  OUT
  ADJUSTMENT
}

model InventoryMovement {
  id        String                @id @default(cuid())
  companyId String                @map("company_id")
  productId String                @map("product_id")
  type      InventoryMovementType
  quantity  Int
  reference String?
  reason    String?
  notes     String?
  createdAt DateTime              @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id])
  product Product @relation(fields: [productId], references: [id])
}
```

### Sale / SaleItem (schema.prisma:309)

```prisma
model Sale {
  id            String          @id @default(cuid())
  companyId     String          @map("company_id")
  customerId    String?         @map("customer_id")
  employeeId    String?         @map("employee_id")
  saleNumber    String          @unique @map("sale_number")
  status        SaleStatus      @default(COMPLETED)
  subtotal      Decimal
  taxAmount     Decimal         @map("tax_amount")
  discountAmount Decimal?        @map("discount_amount")
  totalAmount   Decimal         @map("total_amount")
  paymentMethod PaymentProvider @default(CASH)
  paidAmount    Decimal         @map("paid_amount")
  changeAmount  Decimal         @map("change_amount")
  notes         String?
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  company  Company    @relation(fields: [companyId], references: [id])
  customer Customer?  @relation(fields: [customerId], references: [id])
  employee Employee?  @relation(fields: [employeeId], references: [id])
  items    SaleItem[]
}

model SaleItem {
  id         String   @id @default(cuid())
  saleId     String   @map("sale_id")
  productId  String   @map("product_id")
  quantity   Int
  unitPrice  Decimal
  totalPrice Decimal
  createdAt  DateTime @default(now()) @map("created_at")

  sale    Sale    @relation(fields: [saleId], references: [id])
  product Product @relation(fields: [productId], references: [id])
}
```

---

## Flujo de Datos: Ciclo de Inventario

### 1. Ajuste Manual

```
POST /inventory/adjustments
  │
  ├─ ▶ InventoryService.adjustStock(companyId, dto)
  │     │
  │     ├─ ▶ Prisma.$transaction
  │     │     ├─ ▶ Product.update({ stockQuantity: { increment } })
  │     │     └─ ▶ InventoryMovement.create({ type: ADJUSTMENT })
  │     │
  │     └─ ▶ Retorna { updatedProduct, movement }
```

### 2. Venta (descuento de stock automático)

```
POST /sales  (SalesService.createSale)
  │
  ├─ ▶ Validar stock suficiente por producto
  ├─ ▶ Calcular subtotal, tax, discount, total
  ├─ ▶ Prisma.$transaction
  │     ├─ ▶ Sale.create + SaleItem.create (items)
  │     ├─ ▶ Product.update({ stockQuantity: { decrement } })  ← por cada item
  │     └─ ▶ InventoryMovement.createMany({ type: OUT })       ← por cada item
```

### 3. Consulta de Movimientos

```
GET /inventory/movements
  │
  └─ ▶ InventoryService.findMovements(companyId)
        └─ ▶ Prisma query: InventoryMovement.findMany({ companyId }, include: { product })
```

---

## Pendientes: Extensiones Futuras

### Gestión de Lotes (ProductBatch)

Modelo propuesto (no implementado):

```prisma
model ProductBatch {
  id                String   @id @default(cuid())
  companyId         String   @map("company_id")
  productId         String   @map("product_id")
  batchNumber       String   @map("batch_number")
  quantityReceived  Int      @map("quantity_received")
  quantityAvailable Int      @map("quantity_available")
  purchasePrice     Decimal  @map("purchase_price")
  expirationDate    DateTime? @map("expiration_date")
  supplierId        String?  @map("supplier_id")
  createdAt         DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@index([companyId, productId])
  @@index([expirationDate])
  @@map("product_batches")
}
```

Estrategia FEFO (First Expired, First Out):
- Al vender, seleccionar batch con `expirationDate` más próximo
- Descontar de `quantityAvailable`
- Si el producto no tiene batches, usar el `stockQuantity` directo

### Sucursales Múltiples (Branch)

Modelo propuesto (no implementado):

```prisma
model Branch {
  id        String   @id @default(cuid())
  companyId String   @map("company_id")
  name      String
  address   String?
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id])

  @@index([companyId])
  @@map("branches")
}
```

Cada `ProductBatch` y `InventoryMovement` debería referenciar `branchId` para stock independiente por sucursal.

### Tipos de Movimiento Adicionales

Actualmente: `IN | OUT | ADJUSTMENT`

Futuro: `RETURN | LOSS | TRANSFER`

```prisma
enum InventoryMovementType {
  IN
  OUT
  RETURN
  LOSS
  ADJUSTMENT
  TRANSFER
}
```

### Alertas de Stock

| Tipo | Condición | Acción |
|------|-----------|--------|
| Stock bajo | `stockQuantity <= minStock` | Notificación `LOW_STOCK` (ya implementada en `products.service.ts:193`) |
| Sin stock | `stockQuantity === 0` | Mostrar en dashboard |
| Exceso | `stockQuantity > minStock * 3` | Reporte de capital inmovilizado |

---

## Dashboard de Inventario

El dashboard actual (`dashboard.service.ts`) ya expone métricas de inventario:

```typescript
interface InventoryMetrics {
  totalProducts: number;
  totalValue: number;          // Suma(salePrice * stockQuantity)
  totalItems: number;          // Suma(stockQuantity)
  outOfStockCount: number;
  lowStockCount: number;
  slowMovingCount: number;     // stockQuantity > 50
  categoryDistribution: Array<{ name: string; count: number }>;
}
```

### Frontend: Componentes Relacionados

| Componente | Archivo | Datos |
|-----------|---------|-------|
| Dashboard (tenant) | `components/dashboard/dashboard-client.tsx` | Métricas de inventario + stock bajo |
| Product form | `components/products/product-form.tsx` | Stock inicial y mínimo |
| Sales (product grid) | `components/sales/sale-form.tsx` | Stock disponible por producto |

---

## Seguridad

- **Tenant isolation**: Toda query incluye `companyId` (vía `TenantGuard` que inyecta `request.tenantId`)
- **Permisos**: `INVENTORY_VIEW`, `INVENTORY_INBOUND`, `INVENTORY_OUTBOUND`, `INVENTORY_ADJUST` mapeados a roles en `permissions.constant.ts`
- **Transacciones**: Ajustes de stock envueltos en `Prisma.$transaction` para atomicidad
- **Auditoría**: Cada movimiento queda registrado en `InventoryMovement` (inmutable)

---

## Referencias

| Archivo | Propósito |
|---------|-----------|
| `backend/prisma/schema.prisma` | Modelos `Product`, `InventoryMovement`, `Sale`, `SaleItem` |
| `backend/src/modules/inventory/inventory.service.ts` | Servicio de inventario (lowStock, movements, adjust) |
| `backend/src/modules/inventory/inventory.controller.ts` | Endpoints REST |
| `backend/src/modules/sales/sales.service.ts` | Creación de venta con descuento de stock |
| `backend/src/modules/products/products.service.ts` | Notificación de stock bajo |
| `backend/src/modules/dashboard/dashboard.service.ts` | Métricas de inventario para dashboard |
| `backend/src/common/constants/permissions.constant.ts` | Permisos `INVENTORY_*` y mapeo a roles |
| `frontend/components/dashboard/dashboard-client.tsx` | Dashboard con métricas de inventario |
| `frontend/components/products/product-form.tsx` | Formulario con stock inicial/mínimo |
| `docs/kardes-valorizado.md` | Guía de kardex valorizado y costeo |
