# Análisis: Unidades de Medida y Entrada/Salida de Stock

Fecha: 2026-10-12
Estado: **análisis / contexto** (aún sin plan de implementación ni código)

---

## 1. Motivo

Hoy el sistema solo cuenta **unidades enteras**. No permite:

- Vender por **kilo, litro o metro** (cantidades continuas, requieren decimales).
- Registrar una **compra al por mayor** y convertirla a la unidad que realmente se vende.
  Ejemplo real del usuario: *compro un saco de 50 kg a S/150, el kilo me cuesta S/3, y lo vendo a S/4 el kilo.*
- Distinguir entre la **presentación que compro** (saco, caja x12, docena, botella 750 ml) y la
  **unidad base que almaceno/vendo** (kilo, unidad, litro).
- Registrar una **entrada de mercadería** (compra) desde la interfaz con su costo, para que el
  stock y el costo promedio queden trazables.

---

## 2. Estado actual del sistema (verificado en código)

### 2.1 Modelo de datos (`backend/prisma/schema.prisma`)

| Campo | Tipo | Línea | Observación |
|-------|------|-------|-------------|
| `Product.stockQuantity` | `Int` | 361 | stock entero, default 0 |
| `Product.minStock` | `Int` | 362 | umbral de alerta, default 5 |
| `Product.reorderPoint` / `safetyStock` / `leadTimeDays` | `Int?` | 363-365 | insumos de reposición |
| `Product.costPrice` | `Decimal(10,2)`? | 360 | costo unitario actual (sin unidad definida) |
| `Product.salePrice` | `Decimal(10,2)` | 359 | precio de venta |
| `SaleItem.quantity` | `Int` | 428 | cantidad vendida |
| `InventoryMovement.quantity` | `Int` | (modelo L539) | movimientos IN/OUT/ADJUSTMENT/RETURN/LOSS/TRANSFER |
| `ProductBatch.quantityReceived/available` | `Int` | 490-491 | lotes FEFO |
| `InventoryKardex.qtyIn/qtyOut/balanceQty` | `Int` | 516-524 | kardex **valorizado** (guardado en enteros) |
| `Company.inventoryCostMethod` | `InventoryCostMethod` (FIFO / WEIGHTED_AVERAGE) | 213 | método de costeo, default `WEIGHTED_AVERAGE` |

- **No existe** ningún campo de **unidad de medida** (`unitOfMeasure` / `unit`) en el schema.
  Se busca y no hay resultados.
- Todas las cantidades son `Int` ⇒ hoy **no se puede** representar `2.5 kg` ni `1.75 m`.

### 2.2 Flujos existentes

| Acción | Dónde | Efecto sobre stock | ¿Kardex? |
|--------|-------|--------------------|----------|
| Editar "Stock inicial" del producto | `frontend/components/products/product-form.tsx:388` → `PATCH /products/:id` | **Sobrescribe** el valor (`products.service.ts:258`) | No |
| Ajuste manual | `POST /inventory/adjustments` (`inventory.service.ts:36`) | **Suma** (`increment`) | No (solo `InventoryMovement` tipo `ADJUSTMENT`) |
| Crear lote | `POST /product-batches` (`product-batches.service.ts:12`) | **No toca** `stockQuantity` | No |
| Venta | `sales.service.ts:339` | Resta | Sí (`OUT`) |
| Devolución de distribuidor | `distributors.service.ts:262,346` | Suma | Sí (`IN`) |

**Brechas detectadas**

1. `POST /inventory/adjustments` **existe en el backend pero ningún formulario del frontend lo usa**
   (no hay botón ni pantalla). Es un endpoint huérfano.
2. La pantalla **Lotes** (`frontend/app/(dashboard)/inventory/batches/batches-client.tsx`) es **solo lectura**:
   no hay forma de dar de alta un lote/compra desde la UI.
3. Editar "Stock inicial" **sobrescribe** el stock y **no genera movimiento ni Kardex** ⇒ rompe la
   trazabilidad y descuadra el costo promedio.
4. El **Kardex es valorizado** (`inventoryCostMethod: WEIGHTED_AVERAGE | FIFO`), lo cual es la base
   perfecta para el ejemplo del saco, pero hoy solo se alimenta de ventas y devoluciones.

### 2.3 Conclusión del estado actual

> **No existe hoy un flujo de "Registrar compra / Entrada de mercadería" en la interfaz, ni un
> modelo de unidades de medida.** La única forma práctica de subir stock es editar el producto,
> y eso no deja rastro.

---

## 3. La lógica de las unidades de medida (explicación)

### 3.1 Tres conceptos que hoy están mezclados

| Concepto | Qué es | Ejemplo |
|----------|--------|---------|
| **Unidad base** | La unidad con la que se **almacena** y se controla el stock. Es la más pequeña que se vende. | kilo, litro, metro, unidad |
| **Presentación / empaque** | Cómo **llega la compra** o cómo se ofrece. Se convierte a base con un factor. | saco 50 kg (factor 50), caja x12 (factor 12), docena (factor 12), botella 750 ml |
| **Unidad de venta** | Con qué unidad se **cobra**. Normalmente la base; a veces la presentación. | vender "al kilo" o vender "el saco" |

Hoy el sistema solo tiene "unidad" (entera) y todo lo demás se mete a la fuerza en el **nombre**
del producto (p. ej. dos productos: "Coca-Cola 330 ml" y "Coca-Cola 750 ml").

### 3.2 Unidades discretas vs. continuas

| Tipo | Se cuenta | Necesita decimales | Ejemplos |
|------|-----------|--------------------|----------|
| Discreta | Enteros | No | unidad, caja, docena, six-pack |
| Continua | Fracciones | **Sí** (kg, L, m) | 2.5 kg, 1.75 L, 3.2 m |

Esto obliga a que, si se quiere kilo/litro/metro, las cantidades de stock, venta, movimiento y
kardex pasen de `Int` a `Decimal`.

### 3.3 Tu ejemplo, paso a paso (saco de 50 kg)

**Compra**

- Compras **1 saco de 50 kg** por **S/150**.
- Cantidad en unidad base = `1 saco × 50 kg/saco = 50 kg`.
- Costo unitario base = `150 / 50 = **S/3.00 por kg`**.

**Venta**

- Defines precio de venta **S/4 por kg**.
- Margen por kilo = `4 − 3 = S/1`.
- Si vendes **1 saco completo** → ingreso `50 × 4 = S/200`, ganancia `S/50`.

**Indicadores**

| Indicador | Fórmula | Resultado |
|-----------|---------|-----------|
| Costo unitario base | costo de compra ÷ (cantidad × factor) | `150 / (1×50) = 3.00` |
| Markup sobre costo | `(venta − costo) / costo` | `1 / 3 = 33.3 %` |
- Margen sobre venta = `(precio venta − costo) / precio venta` = `1 / 4` = **25 %**
- Utilidad por saco = `(4 − 3) × 50 = S/50`

**Qué pasa si luego compras más barato/caro (costo promedio ponderado)**

- Compra 1: 50 kg a S/3.00 → S/150
- Compra 2: 30 kg a S/3.60 → S/108
- Costo promedio = `(150 + 108) / 80 = 258 / 80 = **S/3.225 / kg**`

Esto ya lo soporta el sistema: `Company.inventoryCostMethod = WEIGHTED_AVERAGE` y el
`InventoryKardex` guarda `balanceUnitCost` y `balanceTotalCost` (`schema.prisma:161-164`, `524-526`).

### 3.4 Fórmulas maestras

```
cantidadBase   = cantidadPresentacion × factorConversion
costoUnitario  = costoTotalCompra / cantidadBase            (por unidad base)
precioVenta    = (definido por el usuario, por unidad base)
margen         = precioVentaBase − costoPromedioBase
margenPct      = margen / precioVenta × 100
markupPct      = margen / costoUnitario × 100
```

### 3.5 Otros ejemplos aplicables

| Compra real | Factor | Unidad base | Costo compra | Costo/unidad base | Venta sugerida |
|-------------|--------|-------------|--------------|-------------------|----------------|
| Caja de 12 gaseosas | 12 | unidad | S/36 | S/3.00 c/u | S/4.00 c/u |
| Docena de huevos | 12 | unidad | S/12 | S/1.00 c/u | S/1.50 c/u |
| Cable rollo 100 m | 100 | metro | S/250 | S/2.50/m | S/4.00/m |
| Aceite bidón 20 L | 20 | litro | S/160 | S/8.00/L | S/12.00/L |
| Botella 750 ml | 0.75 | litro | S/9 | S/12.00/L | S/18.00/L |
| Botella 330 ml | 0.33 | litro | S/2 | S/6.06/L | (o se vende por unidad) |

> Nota: cuando el factor convierte a una unidad **más pequeña** (botella ml → litro), el factor es
> **decimal** (0.33). Cuando la presentación es **mayor** (saco → kilo), el factor es entero (50).
> El motor debe soportar ambos.

---

## 4. Modelo de datos propuesto (nivel "completo")

> Este es el objetivo de largo plazo. Se puede llegar por etapas (ver §7).

### 4.1 Unidad de medida base

```prisma
enum UnitOfMeasure {
  UNIT    // unidad
  KG      // kilogramo
  LT      // litro
  MT      // metro
}

model Product {
  // ...campos actuales...
  baseUnit      UnitOfMeasure @default(UNIT) @map("base_unit")
  stockQuantity Decimal       @default(0) @map("stock_quantity") @db.Decimal(14, 3)
  minStock      Decimal       @default(0) @map("min_stock")     @db.Decimal(14, 3)
  costPrice     Decimal?      @map("cost_price")  @db.Decimal(12, 4)  // costo por unidad base
  salePrice     Decimal       @map("sale_price")  @db.Decimal(12, 4)  // precio por unidad base

  presentations ProductPresentation[]
}

model ProductPresentation {
  id          String        @id @default(cuid())
  companyId   String        @map("company_id")
  productId   String        @map("product_id")
  name        String        // "Saco 50 kg", "Caja x12", "Botella 750 ml"
  factor      Decimal       @db.Decimal(14, 4)  // cuántas unidades base contiene
  barcode     String?
  salePrice   Decimal?      @map("sale_price") @db.Decimal(12, 4) // precio opcional por presentación
  isDefaultPurchase Boolean @default(false) @map("is_default_purchase")
  createdAt   DateTime      @default(now()) @map("created_at")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([companyId, barcode])
  @@index([productId])
  @@map("product_presentations")
}
```

- `baseUnit` define si la cantidad admite decimales (KG/LT/MT sí; UNIT no).
- `stockQuantity`, `minStock`, `quantity` de venta/movimientos/kardex pasan a `Decimal(14,3)`.
- El dinero se mantiene en `Decimal(12,4)` para costo por unidad base (permite S/0.1650 por unidad).

### 4.2 Movimientos y kardex (cambian de `Int` a `Decimal`)

```prisma
model InventoryMovement {
  // ...
  type        InventoryMovementType
  quantity    Decimal  @db.Decimal(14, 3)   // unidades base
  presentationId String? @map("presentation_id")  // cómo se compró/vendió (opcional)
  unitCost    Decimal? @map("unit_cost") @db.Decimal(12, 4)
  totalCost   Decimal? @map("total_cost") @db.Decimal(12, 4)
}

model InventoryKardex {
  // qtyIn, qtyOut, balanceQty -> Decimal(14,3)
  // unitCostIn/Out, totalCostIn/Out, balanceUnitCost/TotalCost -> Decimal(14,4)
}

model SaleItem {
  quantity    Decimal @db.Decimal(14, 3)   // permite 2.5 kg
  presentationId String? @map("presentation_id")
}
```

### 4.3 Entrada de mercadería (nueva entidad opcional pero recomendable)

Para no perder de dónde vino cada costo (proveedor, comprobante, fecha), conviene una cabecera
de compra:

```prisma
model StockEntry {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  branchId    String?  @map("branch_id")
  supplierId  String?  @map("supplier_id")   // requiere módulo de proveedores
  entryNumber String   @map("entry_number")
  entryDate   DateTime @default(now()) @map("entry_date")
  documentRef String?  @map("document_ref")  // factura/guía
  notes       String?
  createdAt   DateTime @default(now()) @map("created_at")

  items StockEntryItem[]

  @@unique([companyId, entryNumber])
  @@map("stock_entries")
}

model StockEntryItem {
  id           String  @id @default(cuid())
  stockEntryId String  @map("stock_entry_id")
  productId    String  @map("product_id")
  presentationId String? @map("presentation_id")
  quantity     Decimal @db.Decimal(14, 3)  // en presentación
  factor       Decimal @db.Decimal(14, 4)  // factor de conversión
  baseQuantity Decimal @map("base_qty") @db.Decimal(14, 3)
  unitCost     Decimal @map("unit_cost") @db.Decimal(12, 4)  // por unidad base
  totalCost    Decimal @map("total_cost") @db.Decimal(12, 4)

  entry   StockEntry @relation(fields: [entryId]...)
  product Product    @relation(...)
}
```

Flujo al guardar una entrada:

1. `baseQty = cantidad × factor`
2. `unitCost = totalCost / baseQty`
- `Product.stockQuantity += baseQty`
- Crear `InventoryMovement` tipo `IN` (con `unitCost`/`totalCost`).
- Registrar asiento en `InventoryKardex` (`recordInMovement`) ⇒ recalcula **costo promedio ponderado**.
- (Opcional) crear `ProductBatch` con precio de compra y vencimiento ⇒ control FEFO.

---

## 5. Impacto técnico de pasar a "completo"

| Área | Cambio | Riesgo |
|------|--------|--------|
| Prisma schema | `Int` → `Decimal` en stock, venta, movimientos, lotes, kardex; nuevas tablas `ProductPresentation` y `StockEntry` | Alto (migración de datos) |
| Migración | PostgreSQL: `ALTER COLUMN ... TYPE numeric(14,3) USING ...` ; backfill de presentaciones por defecto | Medio |
| Backend | DTOs `@IsInt` → `@IsNumber` con `@IsPositive`; Prisma `Decimal` requiere convertir a/desde `number`/`string` | Alto |
| Serialización | `Prisma.Decimal` no es `JSON` por defecto; revisar `interceptors`/`serializers` existentes | Medio |
| Ventas | `sales.service.ts` y `sale-form.tsx`/`new-sale-modal.tsx` usan `quantity` entero y validan `qty <= stockQuantity` | Alto |
| Kardex | `kardex.service.ts` (`recordInMovement`/`recordOutMovement`) trabaja con `qtyIn/qtyOut` enteros | Medio |
| Lotes | `product-batches.service.ts` (`reserveFromBatch`) usa enteros y hace reconciliación en venta | Medio |
| Distribuidores | `distributors.service.ts` transfiere/retorna cantidades enteras | Medio |
| Frontend | Inputs `type="number"` con `step` según unidad; redondeo a 3 decimales; formateo de cantidades | Alto |
| Reportes/export | `products.service.ts` exporta `stockQuantity` como entero (CSV/Excel/PDF) | Bajo |
| Tests | `*.spec.ts` que afirman cantidades enteras | Medio |

**Decisión clave de migración:** ¿los datos existentes se interpretan como **unidades enteras**
(`baseUnit = UNIT`)? Sí, es lo natural: todo producto actual queda en `UNIT` y sus cantidades
enteras siguen siendo válidas como `Decimal`. Eso hace la migración **segura y sin pérdida**.

---

## 6. Flujos objetivo (entrada y salida de stock)

### 6.1 Entrada (compra / recepción)

```
Producto + Presentación + Cantidad + Costo total (o costo unitario) + Sucursal [+ Lote/vencimiento]
   → cantidadBase = cantidad × factor
   → costoUnitarioBase = costoTotal / cantidadBase
   → Product.stockQuantity += cantidadBase
   → InventoryMovement (IN) + InventoryKardex (recordInMovement)
   → recalcula costo promedio ponderado (o cola FIFO)
   → [opcional] ProductBatch
   → si stock <= minStock, dispara notificación (lógica ya existente)
```

### 6.2 Salida (venta / ajuste negativo / transferencia)

```
cantidadBase = cantidad × factor (si se vendió por presentación)
   → valida cantidadBase <= stockQuantity
   → Product.stockQuantity -= cantidadBase
   → InventoryMovement (OUT | TRANSFER) + InventoryKardex (recordOutMovement)  ← ya existe
```

### 6.3 Ajuste / merma / pérdida

Usar los tipos que ya existen: `ADJUSTMENT`, `LOSS`, `RETURN`. Hoy `adjustStock` no escribe Kardex;
habría que **unificar** para que todo ajuste genere asiento de kardex.

---

## 7. Caminos de implementación (para decidir)

| Opción | Alcance | Esfuerzo | Sirve tu ejemplo del saco |
|--------|---------|----------|---------------------------|
| **A. Solo etiqueta** | `unitOfMeasure` descriptivo en `Product`; cantidades siguen enteras | Bajo | No (no hay conversión ni decimales) |
| **B. Presentación + contenido** | Enum de unidad + `contentValue`/`contentUnit` (ej. 330 ml), conteo entero | Medio | Parcial (no permite kilo fraccionado) |
| **C. Completo** | Unidad base + presentaciones + cantidades `Decimal` + entrada de mercadería | Alto | **Sí** |

**Recomendación:** ir a **C**, pero por **etapas**:

1. **Etapa 1 – Base de datos y unidades**: `baseUnit` en `Product`, cantidades a `Decimal`,
   migración segura (`UNIT` por defecto), ajustar kardex/movimientos a decimal.
2. **Etapa 2 – Presentaciones y entrada**: `ProductPresentation` + pantalla "Registrar entrada"
   (producto, presentación, cantidad, costo, sucursal, lote opcional) que alimenta stock + kardex
   con costo promedio ponderado.
3. **Etapa 3 – Venta por unidad/presentación**: permitir vender 2.5 kg o 1 saco; validaciones y
   formateo en POS y comprobantes.
4. **Etapa 4 – Reportería y lotes**: exportaciones y FEFO en decimal.

---

## 7bis. Ejemplo numérico completo (para validar el motor)

| Paso | Operación | Stock (kg) | Costo prom. (S//kg) | Valor inventario (S/) |
|------|-----------|------------|---------------------|-----------------------|
| Compra 1 | 1 saco 50 kg × S/150 | 50 | 3.0000 | 150.00 |
| Venta | 10 kg × S/4 | 40 | 3.0000 | 120.00 |
| Compra 2 | 1 saco 50 kg × S/180 | 90 | 3.3333 | 300.00 |
| Venta | 2.5 kg × S/4 | 87.5 | 3.3333 | 291.67 |

Comprobación: costo promedio tras compra 2 = (120 + 180) / 90 = 300 / 90 = 3.3333. ✅

---

## 8. Decisiones abiertas (para el plan)

1. ¿Unidad base por producto (`baseUnit`) o catálogo de unidades configurable por empresa?
2. ¿Se permite vender por presentación (1 saco) además de por unidad base (kg)?
3. ¿Qué precisión de cantidad? Propuesta: **3 decimales** en cantidades y **4** en costos unitarios.
4. ¿La entrada de mercadería requiere módulo de **proveedores** (ya planificado en
   `docs/plan/plan-modulo-proveedores-ordenes-automaticas-2026-03-20.md`)?
5. ¿Conversión automática de presentación a base, o el usuario ingresa directamente en base?
6. ¿El `minStock` (alerta 5) se expresa en unidad base? (Propuesta: sí, siempre en base).
7. Redondeo de dinero: ¿por línea o por documento?

---

## 9. Referencias (código revisado)

- `backend/prisma/schema.prisma`
  - `Product` (352), `SaleItem` (424), `Branch` (467), `ProductBatch` (484),
    `InventoryKardex` (508), `InventoryMovement` (539)
  - `enum InventoryMovementType` (152), `enum InventoryCostMethod` (161)
  - `Company.inventoryCostMethod` (213)
- `backend/src/modules/inventory/inventory.service.ts` (`adjustStock` 36, `findLowStock` 14)
- `backend/src/modules/inventory/dto/inventory.dto.ts` (`quantity: number` 7)
- `backend/src/modules/inventory/inventory.controller.ts` (`POST /inventory/adjustments` 32)
- `backend/src/modules/product-batches/product-batches.service.ts` (`create` 12, `reserveFromBatch` 125)
- `backend/src/modules/kardex/kardex.service.ts` (`recordInMovement` 37, `recordOutMovement` 75)
- `backend/src/modules/products/products.service.ts` (`createProduct` 200, `updateProduct` 251)
- `backend/src/modules/sales/sales.service.ts` (movimiento `OUT` 339, kardex 353)
- `backend/src/modules/distributors/distributors.service.ts` (`TRANSFER` 262, `IN` 356)
- `frontend/components/products/product-form.tsx` (campo "Stock inicial" 388)
- `frontend/app/(dashboard)/inventory/batches/batches-client.tsx` (pantalla Lotes, solo lectura)
- `frontend/app/(dashboard)/inventory/inventory-client.tsx` (módulos de inventario)
