# Plan: Unidades de Medida y Entrada/Salida de Stock

> Basado en `docs/analisis/analisis-unidades-medida-entrada-salida-stock.md`.
> Objetivo: soportar unidades continuas (kg/litro/metro), presentaciones que se
> convierten a unidad base (saco 50 kg, caja x12), y un flujo de **entrada de
> mercadería** con costo, manteniendo el kardex valorizado.

---

## 0. Alcance y decisiones bloqueadas

| Tema | Decisión |
|------|----------|
| Unidades base | `enum UnitOfMeasure { UNIT, KG, LT, MT }` (extensible) |
| Precisión cantidades | `Decimal(14,3)` (3 decimales: 0.001) |
| Precisión costos unitarios | `Decimal(12,4)` |
| Precisión totales (dinero) | `Decimal(12,2)` |
| Presentaciones | Modelo `ProductPresentation` (name, factor, barcode?, salePrice?, isDefaultPurchase) |
| Entrada de mercadería | Modelo `StockEntry` + `StockEntryItem` (documento multipartida) |
| Serialización | `Prisma.Decimal` → JSON **string** (igual que `salePrice` hoy). El frontend convierte con `Number()` |
| Datos existentes | Se interpretan como `baseUnit = UNIT` y cantidades enteras → migración **sin pérdida** |
| Migración DB | Se genera el archivo de migración; **no se aplica automáticamente a producción** |

---

## 1. Modelo de datos (cambios en `backend/prisma/schema.prisma`)

### 1.1 Nuevo enum + campos en `Product`

```prisma
enum UnitOfMeasure { UNIT  KG  LT  MT }

model Product {
  baseUnit      UnitOfMeasure @default(UNIT) @map("base_unit")
  stockQuantity Decimal  @default(0) @map("stock_quantity") @db.Decimal(14, 3)
  minStock      Decimal  @default(5) @map("min_stock")      @db.Decimal(14, 3)
  reorderPoint  Decimal? @map("reorder_point")   @db.Decimal(14, 3)
  safetyStock   Decimal? @map("safety_stock")    @db.Decimal(14, 3)
  costPrice     Decimal? @map("cost_price")  @db.Decimal(12,4)
  salePrice     Decimal  @map("sale_price")  @db.Decimal(12,4)

  presentations    ProductPresentation[]
  stockEntryItems  StockEntryItem[]
}
```

### 1.2 Nuevos modelos

- `ProductPresentation` (id, companyId, productId, name, factor `Decimal(14,4)`,
  barcode?, salePrice?, isDefaultPurchase, timestamps; `@@unique([companyId,barcode])`).
- `StockEntry` (id, companyId, branchId?, entryNumber, entryDate, documentRef?, notes?, totalCost, createdByUserId?, timestamps; `@@unique([companyId, entryNumber])`).
- `StockEntryItem` (id, stockEntryId, productId, presentationId?, quantity, factor, baseQuantity, unitCost, totalCost, expirationDate?, batchNumber?).

### 1.3 Cambios `Int` → `Decimal`

| Tabla/campo | De | A |
|-------------|----|---|
| `Product.stockQuantity` / `minStock` / `reorderPoint` / `safetyStock` | `Int` | `Decimal(14,3)` |
| `Product.costPrice` / `salePrice` | `Decimal(10,2)` | `Decimal(12,4)` |
| `SaleItem.quantity` | `Int` | `Decimal(14,3)` |
| `SaleItem.unitPrice` | `Decimal(12,2)` | `Decimal(12,4)` (+ `presentationId?`) |
| `InventoryMovement.quantity` | `Int` | `Decimal(14,3)` (+ `presentationId?`, `unitCost?`, `totalCost?`) |
| `InventoryKardex.qtyIn/qtyOut/balanceQty` | `Int` | `Decimal(14,3)` |
| `InventoryKardex.unitCost*/totalCost*/balance*Cost` | `Decimal(10,2|12,2)` | `Decimal(14,4)` |
| `ProductBatch.quantityReceived/quantityAvailable` | `Int` | `Decimal(14,3)` |
| `DistributorBalance.starting/returned/sold/balanceQuantity` | `Int` | `Decimal(14,3)` |

### 1.4 Relaciones nuevas

- `Company.presentations ProductPresentation[]`, `Company.stockEntries StockEntry[]`
- `Branch.stockEntries StockEntry[]`
- `Product.presentations[]`, `Product.stockEntryItems[]`
- `ProductPresentation.saleItems[]`, `.inventoryMovements[]`, `.stockEntryItems[]`
- `SaleItem.presentation?`, `InventoryMovement.presentation?`

---

## 2. Migración (SQL)

Archivo: `backend/prisma/migrations/<fecha>_unidades_medida_y_entrada_stock/migration.sql`.

Estructura:
1. `CREATE TYPE "UnitOfMeasure" AS ENUM ('UNIT','KG','LT','MT');`
2. `ALTER TABLE products ADD COLUMN base_unit "UnitOfMeasure" NOT NULL DEFAULT 'UNIT';`
3. `ALTER TABLE ... ALTER COLUMN stock_quantity TYPE numeric(14,3) USING stock_quantity::numeric(14,3);` (idem min_stock, reorder_point, safety_stock, etc.).
4. `CREATE TABLE product_presentations (...);` + índices + FKs.
5. `CREATE TABLE stock_entries (...);` + `stock_entry_items (...);` + índices + FKs.
6. `ALTER TABLE sale_items ADD COLUMN presentation_id TEXT;` + FK; ídem `inventory_movements`.
7. `ALTER TABLE inventory_movements ADD COLUMN unit_cost numeric(12,4), ADD COLUMN total_cost numeric(12,4);`

> **No se ejecuta** contra la base de Supabase en este cambio. Comando de despliegue:
> `npm run prisma:migrate` (o `prisma migrate deploy` en el host).

---

## 3. Contrato API

### 3.1 Nuevas rutas

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| `GET` | `/stock-entries` | `INVENTORY_VIEW` | Lista entradas |
| `GET` | `/stock-entries/:id` | `INVENTORY_VIEW` | Detalle |
| `POST` | `/stock-entries` | `INVENTORY_INBOUND` | Registrar compra (multipartida) |
| `DELETE / POST :id/reverse` | `INVENTORY_ADJUST` | Anular entrada (revierte stock + kardex) |
| `GET` | `/products/:id/presentations` | `PRODUCT_LIST` | Listar presentaciones |
| `POST` | `/products/:id/presentations` | `PRODUCT_UPDATE` | Crear presentación |
| `PATCH` | `presentations/:id` ¹ | `PRODUCT_UPDATE` | Editar presentación |
| `DELETE` | `presentations/:id` | `PRODUCT_UPDATE` | Eliminar presentación |

> Alternativa limpia: sub-recurso anidado `products/:id/presentations/:pid`. Se implementa bajo `products` para reusar permisos.

### 3.2 Endpoints modificados

- `POST /products` y `PATCH /products/:id`: aceptan `baseUnit`, `stockQuantity`/`minStock` decimales, y `presentations[]` opcional (solo en create).
- `POST /inventory/adjustments`: acepta `type` (`ADJUSTMENT|IN|OUT|LOSS`), `quantity` decimal, `unitCost?`, `presentationId?`. Para `IN`/`OUT` crea movimiento + **asiento kardex**.
- `POST /sales`: `items[].quantity` decimal y `items[].presentationId?`. Backend convierte presentación→base para descontar stock y calcular precio.
- `POST /product-batches`, `PATCH`, `POST /:id/reserve`: cantidades decimales.

### 3.3 Seguridad

- Reusar permisos existentes: `PRODUCT_*`, `INVENTORY_VIEW/INBOUND/ADJUST`, `KARDEX_VIEW`, `SALE_CREATE`. Roles: `COMPANY_ADMIN`, `MANAGER` (CASHIER solo ventas).
- `StockEntry` es tenant-scoped: todo `where { companyId }`.
- Validaciones: `@IsNumber({ maxDecimalPlaces: 3 })` + `@IsPositive` (cantidad) / `@Min(0)` (stock), `factor` `> 0`, `@IsEnum(UnitOfMeasure)`.
- `ValidationPipe` global ya es `whitelist + forbidNonWhitelisted + transform`; los nuevos DTOs deben declarar todos los campos.

---

## 4. Serialización (contrato number → string)

`Prisma.Decimal` serializa a **string** vía `toJSON()`. Por lo tanto:

- `Product.stockQuantity`, `minStock`, `SaleItem.quantity`, movimientos, lotes, kardex y balances → **string** en el JSON.
- El frontend debe tipar esos campos como `string` y convertir con `Number()` antes de operar (patrón ya usado con `salePrice`).
- Se agrega un helper `frontend/lib/format/quantity.ts` (`formatQuantity(value, unit)`).

---

## 5. Backend — por módulo

### 5.1 `products`
- DTO: `baseUnit`, `stockQuantity`/`minStock` (`@IsNumber`), `presentations?: ProductPresentationInputDto[]`.
- `createProduct`: crea producto + presentaciones en `$transaction`.
- Nuevos: `listPresentations`, `createPresentation`, `updatePresentation`, `removePresentation` (valida tenant + `factor > 0`, no borrar si tiene ventas).
- `findByCompany`: incluir `baseUnit` y `presentations`.
- `sendLowStockNotification` y comparaciones con `.lte()` (Decimal).

## 6. Módulo `stock-entries` (nuevo)

```
modules/stock-entries/
├── dto/stock-entry.dto.ts
├── stock-entries.controller.ts
├── stock-entries.service.ts
└── stock-entries.module.ts
```

Lógica `create`:
1. Validar productos/sucursal de la empresa.
2. Por ítem: `baseQty = quantity × factor` (factor=1 si no hay presentación); `unitCost = totalCost / baseQty` (o el provisto).
3. `Product.stockQuantity += baseQty` (increment con Decimal).
4. `InventoryMovement` tipo `IN` (con `unitCost`/`totalCost`/`presentationId`).
5. `kardexService.recordInMovement(...)` → recalcula costo promedio/FIFO.
6. `ProductBatch` opcional (si viene `expirationDate`/`batchNumber`).
7. Auditar y notificar stock bajo si cruza `minStock`.
Todo dentro de una `$transaction`.

`DELETE /stock-entries/:id` (reversa): resta stock, movimiento `OUT` de reversa, asiento kardex, elimina lotes asociados si su `quantityAvailable` == recibido.

---

## 7. Backend: módulos afectados

| Módulo | Cambio |
|--------|--------|
| `inventory` | `adjustStock` decimal + `type` + kardex en IN/OUT. `findLowStock` usa `.lte`. |
| `kardex` | `qtyIn/Out/balance` Decimal; estrategias usan `.minus/.plus/.lte`. |
| `sales` | `quantity` decimal; resuelve presentación; compara con `.gte`/`.lt`; movimiento `OUT` decimal. |
| `product-batches` | Cantidades Decimal; reconciliación `OPENING` en Decimal. |
| `distributors` | Transferencias/retenciones con Decimal; balances Decimal. |
| `replenishment` / `forecast` | Aritmética con Decimal (`.toNumber()` para cálculos). |
| `reports` / `dashboard` | Sumas de `quantity` (Prisma `_sum` devuelve Decimal) → `Number()`. |
| `products.exportProducts` | `String(stockQuantity)` (ya funciona con Decimal string). |
| `seed-demo.ts` | `baseUnit`, stock decimal de ejemplo (saco 50 kg). |

### 7.1 Registro
- `app.module.ts`: importar `StockEntriesModule`.
- `permissions.constant.ts`: sin permisos nuevos (reusa INVENTORY_*).

---

## 8. Frontend

### 8.1 Contratos y tipos
- `frontend/types/generated.ts`: `UnitOfMeasure`, `Product.baseUnit`, `stockQuantity: string`, `minStock: string`, `ProductPresentation`, `StockEntry`, `StockEntryItem`; `SaleItem.quantity: string`; `quantity` de movimientos/lotes/kardex como `string`; `CreateSaleItemDto.presentationId?`; `CreateInventoryMovementDto` decimal.
- `frontend/lib/shared/sdk.ts`: `ProductSchema` con `stockQuantity: z.string()`, `baseUnit`, `presentations`.
- `frontend/lib/validations/product.validation.ts`: `stockQuantity`/`minStock` `z.coerce.number().min(0)` (sin `.int()`).
- `frontend/lib/validations/sale.validation.ts`: `quantity: z.number().positive()` (sin `.int()`).
- Helper `formatQuantity(value, unit)` + etiqueta de unidad (`kg`, `L`, `m`, `und`).

### 8.2 Pantallas y componentes
- **`components/products/product-form.tsx`**: selector "Unidad de medida"; inputs `step` dinámico (0.001 si continua, 1 si UNIT); sección **Presentaciones** (lista editable: nombre, factor, código de barras, precio).
- **Nueva pantalla `app/(dashboard)/inventory/entries/`**: server page + `stock-entry-form.tsx` (cliente) con partidas: producto, presentación (select), cantidad, costo total, sucursal, lote/vencimiento opcional, y caja de totales con cálculo de costo por unidad base en vivo. Lista de entradas (tabla) + detalle.
- **`components/inventory/…`**: agregar módulo "Entradas" en `inventory-client.tsx`.
- **`components/sales/sale-form.tsx` y `new-sale-modal.tsx`**: cantidad decimal (step según unidad), selector de presentación cuando exista, validación `qtyBase <= stock`.
- **Displays**: `products-client.tsx`, `kardex-client.tsx`, `batches-client.tsx`, `replenishment-client.tsx`, `distributor-operations.tsx`, `sale-detail-client.tsx`, `reports-client.tsx`, `dashboard-client.tsx` → formatear cantidad con unidad.
- **UI/UX**: inputs `inputMode="decimal"`, `step="0.001"` (o `1`), sufijo de unidad, tooltips de equivalencia, estados vacíos, validación inline, diseño consistente con las cards `rounded-[30px]` ya usadas.

### 8.3 Rutas nuevas
- `GET /inventory/entries` (página "Registrar entrada" + historial).
- Enlaces desde `inventory-client.tsx` (módulo "Entradas de mercadería") y desde Productos (botón "Registrar entrada").

---

## 9. Fases de implementación (checklist)

**Fase A — Base de datos**
- [ ] `schema.prisma` (enum, campos, modelos, Int→Decimal).
- [ ] Archivo de migración SQL.
- [ ] `prisma generate`.

**Stage B (backend lógica)**
- [ ] `products` (DTO + presentaciones + decimal).
- [ ] `stock-entries` (módulo nuevo).
- [ ] `inventory`, `kardex`.
- [ ] `sales`, `product-batches`, `distributors`.
- [ ] `replenishment`, `reports`, `dashboard`, `seed-demo`.
- [ ] `app.module.ts`; `npm run lint` (tsc).

### Stage 3 (frontend)
- [ ] Tipos/schemas/validaciones + helper.
- [ ] `product-form` (unidad + presentaciones).
- [ ] Pantalla "Registrar entrada".
- [ ] Sale forms (decimal/presentación).
- [ ] Sitios de display.
- [ ] `npm run lint` + `npm run build`.

### Stage 4 (despliegue)
- [ ] Aplicar migración (`prisma migrate deploy`).
- [ ] Deploy backend (Render) + frontend (Vercel).
- [ ] Smoke test: crear producto kg, registrar entrada saco 50 kg S/150, verificar costo S/3 y stock 50; vender 2.5 kg.

---

## 10. Pruebas

- **Unitarias (backend)**: `sales.service.spec` (stock decimal), `distributors.service.spec` (decrement/increment Decimal), nuevo `stock-entries.service.spec` (conversión y costo).
- **Manual API**: `POST /stock-entries` con `{productId, presentationId, quantity:1, totalCost:150}` → stock 50, kardex IN unitCost 3.0000.
- **E2E**: crear producto `baseUnit=KG`, presentación "Saco 50 kg" factor 50; entrada; venta 2.5 kg; verificar kardex.

---

## 11. Rollout y rollback

- **Rollout**: migración (aditiva y retrocompatible en datos) → backend → frontend. Los campos nuevos son nullable/default, y las cantidades enteras siguen siendo válidas en `Decimal`.
- **Rollback**: las columnas quedan `numeric`; volver a `Int` requiere `USING round(x)::int` (documentado). Recomendado: backup de Supabase antes de migrar.
- **Compatibilidad**: durante el cambio, `stockQuantity` cambia de number→string en el JSON; backend y frontend deben desplegarse juntos.

---

## 12. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Comparaciones `Decimal` con `<`/`<=` no compilan en TS | Usar `.lt/.lte/.gt/.gte/.plus/.minus/.div` |
| Olvidar una referencia a `stockQuantity` entero | Inventario exhaustivo en §1 del análisis; grep final |
| Migración en producción irreversible | Backup + migración aditiva + no auto-aplicar |
| Precisión de dinero | unitCost `(12,4)`, totales `(12,2)`, redondeo al guardar |
| POS con cantidades fraccionarias | Input `step` por unidad + validación server-side |
