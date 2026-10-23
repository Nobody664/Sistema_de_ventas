# Resumen de Implementaciones — Sistema de Ventas

> Fecha: Junio 2026

---

## Índice

1. [Resumen General](#1-resumen-general)
2. [Fase 1: Schema Prisma](#2-fase-1-schema-prisma)
3. [Fase 2: Módulo Kardex + Costing](#3-fase-2-módulo-kardex--costing)
4. [Fase 3: Módulo ProductBatch (Lotes)](#4-fase-3-módulo-productbatch-lotes)
5. [Fase 4: Módulo Replenishment + Forecast](#5-fase-4-módulo-replenishment--forecast)
6. [Fase 5: Módulo Branch (Sucursales)](#6-fase-5-módulo-branch-sucursales)
7. [Fase 6: Frontend — Páginas de Inventario](#7-fase-6-frontend--páginas-de-inventario)
8. [Integraciones Clave](#8-integraciones-clave)
9. [Endpoints API](#9-endpoints-api)
10. [Permisos Nuevos](#10-permisos-nuevos)
11. [Archivos Creados/Modificados](#11-archivos-creadosmodificados)

---

## 1. Resumen General

Se implementó el módulo completo de **gestión de inventario avanzado** que incluye:

- **Kardex valorizado** con costeo FIFO y Promedio Ponderado (Strategy Pattern)
- **Gestión de lotes** por producto con control FEFO (First Expired, First Out)
- **Reposición inteligente** con sugerencias de compra basadas en punto de reorden
- **Pronóstico de demanda** con clasificación ABC
- **Sucursales múltiples** con stock independiente
- **Integración en ventas**: al crear una venta, se registra automáticamente en kardex y se descuentan lotes vía FEFO

---

## 2. Fase 1: Schema Prisma

**Archivo**: `backend/prisma/schema.prisma`

### Nuevos Enums

```prisma
enum InventoryMovementType {
  IN | OUT | ADJUSTMENT | RETURN | LOSS | TRANSFER
}

enum InventoryCostMethod {
  FIFO | WEIGHTED_AVERAGE
}
```

### Nuevos Modelos

| Modelo | Tabla | Propósito |
|--------|-------|-----------|
| `Branch` | `branches` | Sucursales/almacenes por tenant |
| `ProductBatch` | `product_batches` | Lotes por producto con precio compra, vencimiento, cantidad |
| `InventoryKardex` | `inventory_kardex` | Registro cronológico valorizado de inventario |

### Campos Nuevos en Modelos Existentes

**Product**: `reorderPoint`, `safetyStock`, `leadTimeDays`, `lastSoldAt`, relaciones `batches[]`, `kardexEntries[]`

**Company**: `inventoryCostMethod` (FIFO o WEIGHTED_AVERAGE)

**InventoryMovement**: `branchId` (relación a Branch)

---

## 3. Fase 2: Módulo Kardex + Costing

**Ruta**: `backend/src/modules/kardex/`

### Estructura

```
kardex/
├── dto/
│   └── kardex.dto.ts              # QueryKardexDto: productId, startDate, endDate, movementType
├── strategies/
│   ├── costing.strategy.ts        # Interface CostingStrategy { calculateOutCost() }
│   ├── fifo.strategy.ts           # FIFO: consume lotes de inventario más antiguos
│   └── weighted-average.strategy.ts  # Promedio: balanceTotalCost / balanceQty
├── kardex.service.ts              # recordInMovement, recordOutMovement, query, getSummary, getProfitability
├── kardex.controller.ts           # REST endpoints
└── kardex.module.ts               # Module declaration
```

### Strategy Pattern

- **`CostingStrategy`**: interfaz con método `calculateOutCost(productId, quantity, companyId, tx) → { unitCost, totalCost }`
- **`FifoStrategy`**: reconstruye capas de inventario desde los registros de kardex, consume desde la más antigua
- **`WeightedAverageStrategy`**: usa `balanceUnitCost` del último registro de kardex

### KardexService

| Método | Descripción |
|--------|-------------|
| `recordInMovement()` | Crea entrada de kardex para compras/ingresos |
| `recordOutMovement()` | Calcula costo vía estrategia, crea salida en kardex |
| `query()` | Consulta kardex con filtros (producto, fechas, tipo) |
| `getSummary()` | Valor total del inventario agrupado por producto |
| `getProfitability()` | Rentabilidad por producto con revenue - cost |

---

## 4. Fase 3: Módulo ProductBatch (Lotes)

**Ruta**: `backend/src/modules/product-batches/`

### Estructura

```
product-batches/
├── dto/
│   └── product-batch.dto.ts       # CreateProductBatchDto, UpdateProductBatchDto, ReserveBatchDto, QueryProductBatchDto
├── product-batches.service.ts      # CRUD + FEFO + reserve
├── product-batches.controller.ts   # REST endpoints
└── product-batches.module.ts       # Module declaration
```

### Funcionalidad

- **CRUD completo** de lotes por producto
- **FEFO**: `findEarliestBatch()` → batch con fecha de vencimiento más próxima (o sin vencimiento más antiguo)
- **`reserveFromBatch()`**: descuenta cantidad de lotes ordenados por FEFO, atravesando múltiples lotes si es necesario
- **`findExpiring()`**: lotes próximos a vencer (configurable, default 7 días)
- Validaciones: no permite eliminar lotes con `quantityAvailable > 0`

---

## 5. Fase 4: Módulo Replenishment + Forecast

**Ruta**: `backend/src/modules/replenishment/`

### Estructura

```
replenishment/
├── dto/
│   └── replenishment.dto.ts       # ForecastQueryDto, CoverageQueryDto
├── replenishment.service.ts       # getSuggestions(), getCoverageDays()
├── forecast.service.ts            # getDemandAverage(), getDemandAverages() (ABC)
├── replenishment.controller.ts     # REST endpoints
└── replenishment.module.ts         # Module declaration
```

### ReplenishmentService

- **`getSuggestions()`**: productos con stock < reorderPoint. Calcula cantidad sugerida = (demanda diaria × lead time + safety stock) - stock actual. Ordena por prioridad (high si stock ≤ safety stock)
- **`getCoverageDays()`**: stock actual / demanda diaria promedio

### ForecastService

- **`getDemandAverage()`**: promedio de ventas en últimos N días para un producto
- **`getDemandAverages()`**: clasificación ABC para todos los productos:
  - **A**: 80% de ingresos acumulados
  - **B**: 15% siguientes
  - **C**: 5% restantes

---

## 6. Fase 5: Módulo Branch (Sucursales)

**Ruta**: `backend/src/modules/branches/`

### Estructura

```
branches/
├── dto/
│   └── branch.dto.ts              # CreateBranchDto, UpdateBranchDto
├── branches.service.ts             # CRUD con soft-deactivation
├── branches.controller.ts          # REST endpoints
└── branches.module.ts              # Module declaration
```

### Funcionalidad

- CRUD completo con soft-delete (desactivación vía `isActive: false`)
- Acceso restringido a `COMPANY_ADMIN` para crear/editar/eliminar
- `MANAGER` solo lectura
- Relacionado con `ProductBatch` y `InventoryMovement`

---

## 7. Fase 6: Frontend — Páginas de Inventario

### Estructura de Páginas

```
app/(dashboard)/inventory/
├── page.tsx                       # Página principal de inventario
├── inventory-client.tsx           # Cliente: hero card, módulos grid, alertas
├── kardex/
│   ├── page.tsx                   # Server: fetches kardex + products
│   └── kardex-client.tsx          # Cliente: tabla valorizada filtrable
├── batches/
│   ├── page.tsx                   # Server: fetches batches + products + branches + expiring
│   └── batches-client.tsx         # Cliente: lista lotes, filtro, toggle por vencer
├── branches/
│   ├── page.tsx                   # Server: fetches branches
│   └── branches-client.tsx        # Cliente: cards grid, create form, desactivar
└── replenishment/
    ├── page.tsx                   # Server: fetches suggestions + forecast
    └── replenishment-client.tsx   # Cliente: tabs sugerencias + ABC forecast
```

### Sidebar

Se agregó entrada **"Inventario"** (icono `Warehouse`) en la sección **Gestión**, visible para roles `COMPANY_ADMIN` y `MANAGER`.

---

## 8. Integraciones Clave

### Integración en Ventas (`sales.service.ts`)

Al crear una venta (`createSale()`), ahora dentro de la misma transacción Prisma:

1. Se crea `Sale` + `SaleItem`
2. Se descuenta `Product.stockQuantity`
3. Se descuentan lotes vía `ProductBatchesService.reserveFromBatch()` (FEFO)
4. Se crea `InventoryMovement` para cada item
5. Se registra en kardex vía `KardexService.recordOutMovement()` con costeo según método de la empresa

### Integración de Módulos

```
SalesService
  ├── ProductBatchesService.reserveFromBatch()  ← FEFO
  └── KardexService.recordOutMovement()         ← Costing Strategy
        └── FifoStrategy / WeightedAverageStrategy
```

---

## 9. Endpoints API

### Kardex

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/kardex` | `KARDEX_VIEW` | Listar movimientos valorizados |
| GET | `/kardex/products/:id` | `KARDEX_VIEW` | Kardex de un producto |
| GET | `/kardex/summary` | `KARDEX_VIEW` | Valor total del inventario |
| GET | `/kardex/profitability` | `REPORT_FINANCIAL` | Rentabilidad por producto |

### Product Batches

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/product-batches` | `INVENTORY_VIEW` | Listar lotes |
| GET | `/product-batches/expiring` | `INVENTORY_VIEW` | Lotes por vencer |
| GET | `/product-batches/:id` | `INVENTORY_VIEW` | Detalle de lote |
| POST | `/product-batches` | `INVENTORY_INBOUND` | Crear lote |
| PATCH | `/product-batches/:id` | `INVENTORY_ADJUST` | Actualizar lote |
| DELETE | `/product-batches/:id` | `INVENTORY_ADJUST` | Eliminar lote |
| POST | `/product-batches/:id/reserve` | `INVENTORY_OUTBOUND` | Reservar unidades |

### Replenishment

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/replenishment/suggestions` | `REPLENISHMENT_VIEW` | Sugerencias de compra |
| GET | `/replenishment/coverage/:productId` | `REPLENISHMENT_VIEW` | Días de cobertura |
| GET | `/replenishment/forecast` | `FORECAST_VIEW` | Pronóstico ABC |

### Branches

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/branches` | `INVENTORY_VIEW` | Listar sucursales |
| GET | `/branches/:id` | `INVENTORY_VIEW` | Detalle de sucursal |
| POST | `/branches` | `BRANCH_MANAGE` | Crear sucursal |
| PATCH | `/branches/:id` | `BRANCH_MANAGE` | Actualizar sucursal |
| DELETE | `/branches/:id` | `BRANCH_MANAGE` | Desactivar sucursal |

---

## 10. Permisos Nuevos

Agregados en `backend/src/common/constants/permissions.constant.ts`:

| Permiso | COMPANY_ADMIN | MANAGER |
|---------|:---:|:---:|
| `KARDEX_VIEW` | ✅ | ✅ |
| `KARDEX_EXPORT` | ✅ | — |
| `REPLENISHMENT_VIEW` | ✅ | ✅ |
| `REPLENISHMENT_MANAGE` | — | — |
| `FORECAST_VIEW` | ✅ | ✅ |
| `BRANCH_MANAGE` | ✅ | — |

(`SUPER_ADMIN` tiene todos automáticamente)

---

## 11. Archivos Creados/Modificados

### Backend — Creados

| Archivo | Líneas |
|---------|--------|
| `backend/src/modules/kardex/kardex.module.ts` | 18 |
| `backend/src/modules/kardex/kardex.controller.ts` | 50 |
| `backend/src/modules/kardex/kardex.service.ts` | 230 |
| `backend/src/modules/kardex/dto/kardex.dto.ts` | 17 |
| `backend/src/modules/kardex/strategies/costing.strategy.ts` | 15 |
| `backend/src/modules/kardex/strategies/fifo.strategy.ts` | 62 |
| `backend/src/modules/kardex/strategies/weighted-average.strategy.ts` | 32 |
| `backend/src/modules/product-batches/product-batches.module.ts` | 13 |
| `backend/src/modules/product-batches/product-batches.controller.ts` | 72 |
| `backend/src/modules/product-batches/product-batches.service.ts` | 145 |
| `backend/src/modules/product-batches/dto/product-batch.dto.ts` | 51 |
| `backend/src/modules/replenishment/replenishment.module.ts` | 15 |
| `backend/src/modules/replenishment/replenishment.controller.ts` | 50 |
| `backend/src/modules/replenishment/replenishment.service.ts` | 81 |
| `backend/src/modules/replenishment/forecast.service.ts` | 90 |
| `backend/src/modules/replenishment/dto/replenishment.dto.ts` | 15 |
| `backend/src/modules/branches/branches.module.ts` | 12 |
| `backend/src/modules/branches/branches.controller.ts` | 55 |
| `backend/src/modules/branches/branches.service.ts` | 52 |
| `backend/src/modules/branches/dto/branch.dto.ts` | 22 |

### Backend — Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/prisma/schema.prisma` | Modelos Branch, ProductBatch, InventoryKardex; enums; campos nuevos |
| `backend/src/app.module.ts` | Importación de KardexModule, ProductBatchesModule, ReplenishmentModule, BranchesModule |
| `backend/src/common/constants/permissions.constant.ts` | 6 nuevos permisos + asignación a roles |
| `backend/src/modules/sales/sales.service.ts` | Integración de kardex y batches en createSale() |
| `backend/src/modules/sales/sales.module.ts` | Importación de KardexModule, ProductBatchesModule |

### Frontend — Creados

| Archivo | Líneas |
|---------|--------|
| `frontend/app/(dashboard)/inventory/page.tsx` | 28 |
| `frontend/app/(dashboard)/inventory/inventory-client.tsx` | 139 |
| `frontend/app/(dashboard)/inventory/kardex/page.tsx` | 23 |
| `frontend/app/(dashboard)/inventory/kardex/kardex-client.tsx` | 175 |
| `frontend/app/(dashboard)/inventory/batches/page.tsx` | 26 |
| `frontend/app/(dashboard)/inventory/batches/batches-client.tsx` | 169 |
| `frontend/app/(dashboard)/inventory/branches/page.tsx` | 12 |
| `frontend/app/(dashboard)/inventory/branches/branches-client.tsx` | 154 |
| `frontend/app/(dashboard)/inventory/replenishment/page.tsx` | 20 |
| `frontend/app/(dashboard)/inventory/replenishment/replenishment-client.tsx` | 190 |

### Frontend — Modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/types/generated.ts` | Interfaces InventoryKardex, ProductBatch, Branch; campos nuevos |
| `frontend/types/api.ts` | Exportación de nuevos tipos |
| `frontend/components/layout/app-sidebar.tsx` | Entrada "Inventario" en Gestión |

---

## Documentación Asociada

| Archivo | Contenido |
|---------|-----------|
| `docs/guia-stock-almacenes.md` | Guía completa de inventario, stock, almacenes |
| `docs/kardes-valorizado.md` | Documentación técnica del kardex valorizado |
| `docs/plan/plan-inventario-kardex-lotes.md` | Plan de implementación original |
| `docs/resumen-implementaciones.md` | Este documento |

---

## Estado de TypeCheck

| Proyecto | Estado |
|----------|--------|
| Backend (`npm run lint`) | ✅ Sin errores |
| Frontend (`npm run lint`) | ✅ Solo errores pre-existentes de `BarcodeDetector` |
