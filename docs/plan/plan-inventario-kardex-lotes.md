# Plan de Implementación: Inventario, Kardex, Lotes y Reabastecimiento

## Prioridades

| Prioridad | Componente | Guía origen | Esfuerzo |
|-----------|-----------|-------------|----------|
| 🔴 Alta | Schema Prisma (modelos + campos) | Ambas | 1 día |
| 🔴 Alta | Módulo Kardex + Costing (FIFO/Promedio) | `kardes-valorizado.md` | 2 días |
| 🔴 Alta | Módulo ProductBatch (lotes + FEFO) | `guia-stock-almacenes.md` | 2 días |
| 🟡 Media | Módulo Replenishment + Forecast | `kardes-valorizado.md` | 1 día |
| 🟡 Media | Módulo Branch (sucursales) | `guia-stock-almacenes.md` | 1 día |
| 🟢 Baja | Frontend: páginas de inventario/kardex | Ambas | 2 días |

---

## Fase 1: Schema Prisma

### 1.1 Extender `InventoryMovementType` enum

```prisma
enum InventoryMovementType {
  IN
  OUT
  ADJUSTMENT
  RETURN       // ← nuevo
  LOSS         // ← nuevo
  TRANSFER     // ← nuevo
}
```

### 1.2 Agregar `Branch` model

```prisma
model Branch {
  id        String   @id @default(cuid())
  companyId String   @map("company_id")
  name      String
  address   String?
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  @@index([companyId])
  @@map("branches")
}
```

### 1.3 Agregar `ProductBatch` model

```prisma
model ProductBatch {
  id                String    @id @default(cuid())
  companyId         String    @map("company_id")
  productId         String    @map("product_id")
  branchId          String?   @map("branch_id")
  batchNumber       String    @map("batch_number")
  quantityReceived  Int       @map("quantity_received")
  quantityAvailable Int       @map("quantity_available")
  purchasePrice     Decimal   @map("purchase_price")
  expirationDate    DateTime? @map("expiration_date")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  branch  Branch? @relation(fields: [branchId], references: [id], onDelete: SetNull)

  @@index([companyId, productId])
  @@index([expirationDate])
  @@map("product_batches")
}
```

### 1.4 Agregar `InventoryKardex` model

```prisma
model InventoryKardex {
  id               String   @id @default(cuid())
  companyId        String   @map("company_id")
  productId        String   @map("product_id")
  movementId       String?  @map("movement_id")
  movementDate     DateTime @map("movement_date")
  movementType     String   @map("movement_type")

  qtyIn            Int      @default(0) @map("qty_in")
  unitCostIn       Decimal? @map("unit_cost_in")
  totalCostIn      Decimal? @map("total_cost_in")

  qtyOut           Int      @default(0) @map("qty_out")
  unitCostOut      Decimal? @map("unit_cost_out")
  totalCostOut     Decimal? @map("total_cost_out")

  balanceQty       Int      @map("balance_qty")
  balanceUnitCost  Decimal  @map("balance_unit_cost")
  balanceTotalCost Decimal  @map("balance_total_cost")

  createdAt        DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([companyId, productId, movementDate])
  @@index([companyId, movementDate])
  @@map("inventory_kardex")
}
```

### 1.5 Extender `Product` model

```prisma
model Product {
  // ... campos existentes ...
  // Agregar:
  reorderPoint     Int?      @map("reorder_point")
  safetyStock      Int?      @map("safety_stock")
  leadTimeDays     Int?      @map("lead_time_days")
  lastSoldAt       DateTime? @map("last_sold_at")

  // Nuevas relaciones
  batches          ProductBatch[]
  kardexEntries    InventoryKardex[]
}
```

### 1.6 Extender `Company` model

```prisma
model Company {
  // ... campos existentes ...
  inventoryCostMethod String @default("WEIGHTED_AVERAGE") @map("inventory_cost_method")
  branches           Branch[]
}
```

### 1.7 Relaciones en `Product` y `InventoryMovement`

Agregar `branchId` opcional a `InventoryMovement`:

```prisma
model InventoryMovement {
  // ... campos existentes ...
  branchId String? @map("branch_id")
  branch   Branch? @relation(fields: [branchId], references: [id])
}
```

---

## Fase 2: Módulo Kardex + Costing (Backend)

### 2.1 Estructura

```
backend/src/modules/kardex/
├── dto/
│   └── kardex.dto.ts
├── strategies/
│   ├── costing.strategy.ts       (interface)
│   ├── fifo.strategy.ts
│   └── weighted-average.strategy.ts
├── kardex.service.ts
├── kardex.controller.ts
└── kardex.module.ts
```

### 2.2 CostingService (Strategy Pattern)

- `CostingStrategy` interface: `calculateOutCost(productId, quantity, companyId, tx) → { unitCost, totalCost }`
- `FifoStrategy`: consume lotes más antiguos, devuelve costo ponderado de las unidades retiradas
- `WeightedAverageStrategy`: divide balanceTotalCost / balanceQty del último kardex

### 2.3 KardexService

- `recordInMovement()`: crear entrada en kardex (compra/ajuste IN)
- `recordOutMovement()`: calcular costo vía estrategia, crear salida en kardex
- `query()`: consultar kardex con filtros (producto, fechas, sucursal)
- `getSummary()`: valor total del inventario
- `getProfitability()`: rentabilidad por producto/categoría

### 2.4 Integración con SalesService

Hookear `recordOutMovement()` dentro de la transacción de `createSale()`.

---

## Fase 3: Módulo ProductBatch (Backend)

### 3.1 Estructura

```
backend/src/modules/product-batches/
├── dto/
│   └── product-batch.dto.ts
├── product-batches.service.ts
├── product-batches.controller.ts
└── product-batches.module.ts
```

### 3.2 Funcionalidad

- CRUD de lotes por producto
- FEFO: `findEarliestBatch(productId, quantity)` → batch más próximo a vencer
- `reserveFromBatch(productId, quantity)`: descontar de `quantityAvailable`
- Alertas de vencimiento: lotes con `expirationDate < 7` días
- Integrar en venta: al crear sale, seleccionar batch por FEFO y descontar

---

## Fase 4: Módulo Replenishment + Forecast (Backend)

### 4.1 Estructura

```
backend/src/modules/replenishment/
├── dto/
│   └── replenishment.dto.ts
├── replenishment.service.ts
├── replenishment.controller.ts
├── forecast.service.ts
└── replenishment.module.ts
```

### 4.2 ReplenishmentService

- `getSuggestions()`: productos con stock < reorderPoint
- `generatePurchaseOrders()`: crear órdenes sugeridas
- `getCoverageDays(product)`: stock / demanda diaria promedio

### 4.3 ForecastService

- `getDemandAverage(productId, days)`: promedio de ventas en últimos N días
- Clasificación ABC: A (80% ingresos), B (15%), C (5%)

---

## Fase 5: Módulo Branch (Backend)

### 5.1 Estructura

```
backend/src/modules/branches/
├── dto/
│   └── branch.dto.ts
├── branches.service.ts
├── branches.controller.ts
└── branches.module.ts
```

### 5.2 Funcionalidad

- CRUD de sucursales por tenant
- Asociar productos/lotes a sucursal

---

## Fase 6: Frontend

### 6.1 Páginas nuevas

| Ruta | Componente | Datos |
|------|-----------|-------|
| `/inventory` | Página principal de inventario | Stock, valorizado, alerts |
| `/inventory/kardex` | Kardex valorizado (con filtros) | Movements + costos |
| `/inventory/batches` | Gestión de lotes | CRUD por producto |
| `/inventory/branches` | Sucursales | CRUD (SuperAdmin/CompanyAdmin) |
| `/inventory/replenishment` | Sugerencias de compra | Reorder alerts |

### 6.2 Sidebar

Agregar entrada "Inventario" en el grupo "Gestión" del sidebar con submódulos.

---

## Archivos a modificar/crear

### Schema
- `backend/prisma/schema.prisma` — modelos, enums, campos, relaciones

### Backend (nuevos módulos)
- `backend/src/modules/kardex/` — kardex service + controller + strategies
- `backend/src/modules/product-batches/` — batch CRUD + FEFO
- `backend/src/modules/replenishment/` — reorder + forecast
- `backend/src/modules/branches/` — branch CRUD

### Backend (modificaciones)
- `backend/src/app.module.ts` — importar nuevos módulos
- `backend/src/modules/sales/sales.service.ts` — hook kardex + batch en venta
- `backend/src/modules/sales/sales.module.ts` — importar kardex + batches
- `backend/src/common/constants/permissions.constant.ts` — nuevos permisos

### Frontend (nuevo)
- `frontend/app/(dashboard)/inventory/` — carpeta con páginas
- `frontend/components/inventory/` — componentes de inventario
- `frontend/app/(dashboard)/inventory/kardex/` — página de kardex
- `frontend/app/(dashboard)/inventory/batches/` — página de lotes
- `frontend/app/(dashboard)/inventory/branches/` — página de sucursales
- `frontend/app/(dashboard)/inventory/replenishment/` — página de reposición

### Frontend (modificaciones)
- `frontend/components/layout/app-sidebar.tsx` — enlace a inventario
