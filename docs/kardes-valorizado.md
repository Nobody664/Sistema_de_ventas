# Kardex Valorizado y Reabastecimiento Inteligente

## Estado del Proyecto

| Componente | Estado | Prioridad |
|-----------|--------|-----------|
| Movimientos de inventario (`InventoryMovement`) | ✅ Existente | — |
| Costo en producto (`Product.costPrice`) | ✅ Existente | — |
| Precio de venta (`Product.salePrice`) | ✅ Existente | — |
| Stock mínimo (`Product.minStock`) | ✅ Existente | — |
| Tabla `InventoryKardex` | ❌ No implementada | Alta |
| Costeo FIFO / Promedio Ponderado | ❌ No implementado | Alta |
| Rentabilidad real por producto | ❌ No implementado | Alta |
| Punto de reorden (`reorderPoint`) | ❌ No implementado | Media |
| Stock de seguridad (`safetyStock`) | ❌ No implementado | Media |
| Forecast de demanda | ❌ No implementado | Baja |
| Órdenes de compra automáticas | ❌ No implementado | Baja |

---

## Arquitectura Propuesta para el Módulo de Kardex

```
backend/src/modules/kardex/
├── dto/
│   ├── kardex.dto.ts              # Filtros de consulta
│   └── reorder.dto.ts             # Configuración de reorden
├── kardex.module.ts               # Importa PrismaModule
├── kardex.controller.ts           # GET /kardex, GET /kardex/products/:id
├── kardex.service.ts              # Cálculo de kardex + costeo
├── costing.service.ts             # Estrategias FIFO / Weighted Average
├── replenishment.service.ts       # Punto de reorden + sugerencias
└── forecast.service.ts            # Forecast básico de demanda
```

### Dependencias

```
KardexService ──▶ PrismaService (lectura de InventoryMovement, SaleItem)
                ▶ CostingService (estrategia de costeo)
                ▶ ReplenishmentService (reorden + sugerencias)
                ▶ ForecastService (demanda histórica)
```

---

## Extensiones al Schema Prisma

### 1. Tabla InventoryKardex (nueva)

```prisma
model InventoryKardex {
  id             String   @id @default(cuid())
  companyId      String   @map("company_id")
  productId      String   @map("product_id")
  movementId     String?  @map("movement_id")      // Referencia a InventoryMovement (nullable para inicial)
  movementDate   DateTime @map("movement_date")
  movementType   String   @map("movement_type")     // IN | OUT | RETURN | ADJUSTMENT

  // Entradas
  qtyIn          Int      @default(0) @map("qty_in")
  unitCostIn     Decimal? @map("unit_cost_in")      // Costo del lote que ingresa
  totalCostIn    Decimal? @map("total_cost_in")

  // Salidas
  qtyOut         Int      @default(0) @map("qty_out")
  unitCostOut    Decimal? @map("unit_cost_out")     // Costo según método (FIFO/Promedio)
  totalCostOut   Decimal? @map("total_cost_out")

  // Saldo
  balanceQty        Int     @map("balance_qty")
  balanceUnitCost   Decimal @map("balance_unit_cost")
  balanceTotalCost  Decimal @map("balance_total_cost")

  createdAt      DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@index([companyId, productId, movementDate])
  @@index([companyId, movementDate])
  @@map("inventory_kardex")
}
```

### 2. Campos adicionales en Product (extensión)

```prisma
model Product {
  // ... campos existentes ...

  costPrice       Decimal?  @map("cost_price")       // ← ya existe, usado como base
  reorderPoint    Int?      @map("reorder_point")    // ← nuevo: punto de reorden
  safetyStock     Int?      @map("safety_stock")     // ← nuevo: stock de seguridad
  leadTimeDays    Int?      @map("lead_time_days")   // ← nuevo: días de reposición
  lastSoldAt      DateTime? @map("last_sold_at")     // ← nuevo: última venta (para rotación)
}
```

### 3. Configuración de costeo por empresa

```prisma
model Company {
  // ... campos existentes ...
  inventoryCostMethod String @default("WEIGHTED_AVERAGE") @map("inventory_cost_method")
  // VALORES: "FIFO" | "WEIGHTED_AVERAGE"
}
```

---

## Métodos de Costeo

### Estrategia: Patrón Strategy

```typescript
// costing.service.ts
interface CostingStrategy {
  name: string;
  calculateOutCost(
    productId: string,
    quantity: number,
    companyId: string,
    tx: PrismaTx,
  ): Promise<{ unitCost: Decimal; totalCost: Decimal }>;
}

class FifoStrategy implements CostingStrategy {
  // Consume los lotes más antiguos primero
  // Busca InventoryKardex ordenado por movementDate ASC
  // donde balanceQty > 0 y movementType = IN
  // Descuenta quantity del lote más antiguo primero
}

class WeightedAverageStrategy implements CostingStrategy {
  // Calcula: balanceTotalCost / balanceQty
  // Aplica el mismo costo unitario a todas las salidas
}

class CostingService {
  private strategies: Map<string, CostingStrategy>;

  getStrategy(companyId: string): CostingStrategy {
    // Lee company.inventoryCostMethod
    // Retorna la estrategia correspondiente
  }

  async recordOutMovement(
    companyId: string,
    productId: string,
    quantity: number,
    referenceId: string,
    tx: PrismaTx,
  ): Promise<void> {
    const strategy = this.getStrategy(companyId);
    const { unitCost, totalCost } = await strategy.calculateOutCost(
      productId, quantity, companyId, tx,
    );
    // Crear registro en InventoryKardex
  }
}
```

### FIFO (First In, First Out)

```
Compra 1: 10 unid x S/10.00  →  lote A
Compra 2: 10 unid x S/12.00  →  lote B

Venta: 12 unid
  → 10 unid salen a S/10.00 (lote A)
  →  2 unid salen a S/12.00 (lote B)
  → Costo venta: (10 × 10) + (2 × 12) = S/124.00
  → Saldo: 8 unid x S/12.00 = S/96.00
```

### Promedio Ponderado

```
Compra 1: 10 unid x S/10.00  →  total S/100.00
Compra 2: 10 unid x S/12.00  →  total S/120.00

Costo promedio: (100 + 120) / 20 = S/11.00

Venta: 12 unid x S/11.00  →  costo venta: S/132.00
  → Saldo: 8 unid x S/11.00 = S/88.00
```

---

## Flujo de Datos: Kardex

### Escritura (en venta)

```
POST /sales  (SalesService.createSale)
  │
  ├─ ▶ Transacción Prisma
  │     ├─ ▶ Sale.create + SaleItem.create
  │     ├─ ▶ Product.update({ stockQuantity: { decrement } })
  │     ├─ ▶ InventoryMovement.create({ type: OUT })
  │     └─ ▶ KardexService.recordOutMovement(companyId, productId, qty, saleId, tx)
  │             │
  │             └─ ▶ CostingService: calcular unitCost según método
  │                   └─ ▶ InventoryKardex.create({ qtyOut, unitCostOut, balance... })
```

### Lectura (consulta)

```
GET /kardex?productId=X&startDate=Y&endDate=Z
  │
  └─ ▶ KardexService.query(companyId, filters)
        └─ ▶ InventoryKardex.findMany({ where: { companyId, productId, movementDate: { gte, lte } } })
              └─ ▶ Retorna líneas de kardex (inmutables)
```

---

## API Propuesta

### Endpoints de Kardex

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| `GET` | `/kardex` | `INVENTORY_VIEW` | Listar movimientos valorizados (con filtros) |
| `GET` | `/kardex/products/:id` | `INVENTORY_VIEW` | Kardex de un producto específico |
| `GET` | `/kardex/summary` | `INVENTORY_VIEW` | Resumen: valor total del inventario |
| `GET` | `/kardex/profitability` | `REPORT_FINANCIAL` | Rentabilidad por producto/categoría |

### Endpoints de Reabastecimiento

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| `GET` | `/replenishment/suggestions` | `INVENTORY_VIEW` | Productos que necesitan reposición |
| `PATCH` | `/products/:id/reorder` | `PRODUCT_UPDATE` | Configurar punto de reorden y safety stock |
| `GET` | `/replenishment/forecast` | `REPORT_FINANCIAL` | Forecast de demanda (30/60/90 días) |

---

## Rentabilidad Real

### Cálculo actual (limitado)

Actualmente el sistema solo almacena `Product.costPrice` y `Product.salePrice`. La ganancia se calcula como:

```typescript
const gananciaPorUnidad = salePrice - costPrice;
const margen = (gananciaPorUnidad / salePrice) * 100;
```

### Cálculo con Kardex (preciso)

Con kardex valorizado, el costo de venta refleja el costo real de los lotes despachados:

```typescript
const gananciaReal = saleItem.unitPrice - actualUnitCost;  // del kardex
const margenReal = (gananciaReal / saleItem.unitPrice) * 100;
```

La diferencia es significativa cuando hay inflación o variación de costos entre compras.

---

## Dashboard Financiero Propuesto

| Widget | Datos | Origen |
|--------|-------|--------|
| 💰 Inventario valorizado | `SUM(balanceTotalCost)` | Kardex |
| 📈 Ganancia bruta (período) | `SUM(ventas) - SUM(costo_ventas)` | Kardex + Sales |
| 📊 Margen promedio | Promedio de márgenes por producto | Kardex |
| 🔥 Productos más rentables | Top 10 por ganancia total | Kardex + Sales |
| 📉 Productos menos rentables | Bottom 10 por margen | Kardex + Sales |
| 🚚 Sugerencias de compra | Productos con stock < reorderPoint | Replenishment |
| ⏳ Cobertura de inventario | `stockActual / demandaDiariaPromedio` | Forecast |

---

## Cobertura y Punto de Reorden

### Fórmula

```
Punto de Reorden = (Demanda Diaria Promedio × Lead Time) + Stock de Seguridad
```

### Ejemplo

```typescript
const demandaDiaria = 5;       // ventas promedio últimos 30 días
const leadTime = 7;            // días que tarda el proveedor
const safetyStock = 10;        // margen de seguridad

const reorderPoint = (5 * 7) + 10;  // = 45 unidades
```

### Alerta de Reabastecimiento

```typescript
// ReplenishmentService.generateSuggestions()
const products = await prisma.product.findMany({
  where: {
    companyId,
    reorderPoint: { not: null },
    stockQuantity: { lte: prisma.product.fields.reorderPoint },
  },
});
// Para cada producto, sugerir: (reorderPoint - stockActual) * 2
```

---

## Trabajos Programados (BullMQ / Cron)

| Frecuencia | Tarea | Servicio |
|-----------|-------|---------|
| Diaria | Revisar stock bajo y generar sugerencias | `ReplenishmentService` |
| Diaria | Calcular demanda promedio (30/60/90 días) | `ForecastService` |
| Semanal | Generar sugerencias de compra | `ReplenishmentService` |
| Mensual | Ejecutar ABC Inventory | `KardexService` |
| Mensual | Valorizar inventario completo | `KardexService` |

---

## Permisos Necesarios (Nuevos)

```typescript
enum Permission {
  // ... existentes ...

  KARDEX_VIEW = 'kardex:view',
  KARDEX_EXPORT = 'kardex:export',
  REPLENISHMENT_VIEW = 'replenishment:view',
  REPLENISHMENT_MANAGE = 'replenishment:manage',
  FORECAST_VIEW = 'forecast:view',
}
```

---

## Referencias

| Archivo | Propósito |
|---------|-----------|
| `backend/prisma/schema.prisma` | Modelos `Product`, `InventoryMovement`, `Sale`, `SaleItem`, `Company` |
| `backend/src/modules/inventory/inventory.service.ts` | Servicio actual de inventario |
| `backend/src/modules/sales/sales.service.ts` | Creación de venta (referencia para hooks de kardex) |
| `backend/src/modules/dashboard/dashboard.service.ts` | Dashboard con métricas actuales |
| `backend/src/common/constants/permissions.constant.ts` | Permisos existentes |
| `docs/guia-stock-almacenes.md` | Guía completa de inventario actual |
