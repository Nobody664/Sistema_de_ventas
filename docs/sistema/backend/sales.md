# Módulo: sales

## Propósito

Registra y consulta ventas (`Sale`/`SaleItem`): crea ventas del canal POS/ONLINE (descuento de stock,
asientos de kardex, notificaciones de stock bajo, auditoría) y ventas del canal `DISTRIBUTOR`
(delegadas a `DistributorsService`, sin descontar stock propio porque la mercadería ya fue
transferida). También lista ventas recientes (paginadas), detalla una venta, **anula o reembolsa una
venta completada** (reversión de stock + kardex + auditoría) y exporta a CSV/Excel/PDF. Acepta
**cupones de descuento** (`couponCode`) resueltos transaccionalmente vía `DiscountsService`.
Requiere el módulo de plan `sales`.

## Archivos clave

- `backend/src/modules/sales/sales.controller.ts` — rutas de ventas (listar, detalle, exportar, crear, cancelar, reembolsar).
- `backend/src/modules/sales/sales.service.ts` — flujo de creación de venta, consultas, reversión (`reverseSale`) y exportación.
- `backend/src/modules/sales/dto/sale.dto.ts` — DTOs `CreateSaleDto`, `CreateSaleItemDto` (interno), `QuerySalesDto`, `CancelSaleDto` y `ExportSalesQueryDto`.
- `backend/src/modules/sales/sales.service.spec.ts` — pruebas de `createSale`.
- `backend/src/modules/sales/sales.module.ts` — importa `NotificationsModule`, `LowStockModule`, `KardexModule`, `ProductBatchesModule`, `DistributorsModule`, `DiscountsModule`, `PrismaModule`.

## Autorización a nivel de controlador

- `@Controller('sales')` → base real `/api/sales`.
- Guards de clase: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`.
- `@RequireModule('sales')` a nivel de clase. No hay `@RequireFeature` ni `@LimitResource`.
- Guards globales (registrados en `AppModule`): `CsrfGuard` (mutaciones), `ThrottlerGuard`,
  `JwtAuthGuard`, `RolesGuard`, `PlanCapabilitiesGuard`.

## Endpoints

### GET /api/sales/export
- **Descripción**: Exporta ventas filtradas a CSV, Excel o PDF (devuelto en base64).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([sale:export])`.
- **Plan**: `@RequireModule('sales')`.
- **Guards extra**: ninguno.
- **Query (DTO `ExportSalesQueryDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `format` | `'csv' \| 'excel' \| 'pdf'` | No (def. `csv`) | `@IsIn([...])` | Formato de salida |
  | `startDate` | string (date) | No | `@IsDateString()` | Filtra `createdAt >= startDate` |
  | `endDate` | string (date) | No | `@IsDateString()` | Filtra `createdAt <= endDate` |
  | `status` | `SaleStatus` | No | `@IsIn(['COMPLETED','CANCELLED','REFUNDED','PENDING'])` | Filtra por estado |
  | `customerId` | string | No | `@IsString()` | Filtra por cliente |
  | `channel` | `SaleChannel` | No | `@IsIn(['POS','DISTRIBUTOR','ONLINE'])` | Filtra por canal |

- **Respuesta**: `{ filename, contentType, data }` donde `data` es base64.
  - `csv` → `filename: ventas_<YYYY-MM-DD>.csv`, `contentType: text/csv` (contenido CSV real).
  - `excel` → `filename: ventas_<YYYY-MM-DD>.json`, `contentType: application/json` (JSON codificado en base64; no es un .xlsx real).
  - `pdf` → `filename: ventas_<YYYY-MM-DD>.html`, `contentType: text/html` (HTML codificado en base64).
- **Efectos secundarios**: solo lectura.
- **Errores**: ninguno explícito.
- **Nota**: el HTML del reporte escapa valores con `escapeHtml` (solo en la rama PDF).

### GET /api/sales/:id
- **Descripción**: Detalle de una venta con cliente, empleado, cupón aplicado e items (con nombre de producto).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER','CASHIER'])` + `@Permissions([sale:view_detail])`.
- **Plan**: `@RequireModule('sales')`.
- **Guards extra**: ninguno.
- **Path params**: `id`.
- **Respuesta**: `Sale` con `customer`, `employee`, `coupon {id, code, type, value}` e `items[].product {name}`.
- **Efectos secundarios**: solo lectura.
- **Errores**: 404 `NotFoundException('Venta no encontrada.')` si el `id` no pertenece a la empresa.

### GET /api/sales
- **Descripción**: Lista ventas recientes de la empresa (paginado).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER','CASHIER'])` + `@Permissions([sale:list])`.
- **Plan**: `@RequireModule('sales')`.
- **Guards extra**: ninguno.
- **Query (`QuerySalesDto`)**: `page` (entero `>= 1`, def. 1), `limit` (entero `>= 1`, def. 20, máx 100).
- **Respuesta**: **array** (sin envoltorio `{items,total}`) de `{ id, saleNumber, totalAmount, paymentMethod, status, channel, createdAt, customer {firstName,lastName}, employee {firstName} }`, orden `createdAt` desc, con `skip/take` según la paginación. El formato array se mantiene deliberadamente por compatibilidad con el frontend.
- **Efectos secundarios**: solo lectura.
- **Errores**: el controller registra logs (`Logger`) y re-lanza cualquier error.

### POST /api/sales
- **Descripción**: Crea una venta. Si `channel = 'DISTRIBUTOR'`, delega en `DistributorsService.registerSale`; en otro caso ejecuta el flujo POS/ONLINE descrito abajo.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER','CASHIER'])` + `@Permissions([sale:create])`.
- **Plan**: `@RequireModule('sales')`.
- **Guards extra**: ninguno (mutación → `Content-Type: application/json` por CsrfGuard).
- **Body (DTO `CreateSaleDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `customerId` | string | No | `@IsString()` | Cliente (se valida en la empresa) |
  | `employeeId` | string | No | `@IsString()` | Empleado (se valida en la empresa) |
  | `channel` | `'POS' \| 'DISTRIBUTOR' \| 'ONLINE'` | No | `@IsIn([...])` | Canal (def. `POS` en el servicio) |
  | `distributorId` | string | No | `@IsString()` | Obligatorio si `channel = DISTRIBUTOR` |
  | `paymentMethod` | `'CASH' \| 'CARD' \| 'TRANSFER'` | Sí | `@IsIn([...])` | Método de pago |
  | `taxAmount` | number | No | `@IsNumber()` | Impuesto (def. 0) |
  | `discountAmount` | number | No | `@IsNumber()` | Descuento total (def. 0) |
  | `couponCode` | string | No | `@IsString()` | Código de cupón; **incompatible con `discountAmount > 0`** |
  | `items` | `CreateSaleItemDto[]` | Sí | `@IsArray()`, `@ArrayMinSize(1)`, `@ValidateNested({each:true})` | Al menos 1 item |

  `CreateSaleItemDto` (clase interna):

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `productId` | string | Sí | `@IsString()` | Producto |
  | `presentationId` | string | No | `@IsString()` | Presentación (debe pertenecer al producto) |
  | `quantity` | number | Sí | `@IsNumber({maxDecimalPlaces:3})`, `@Min(0.001)`, `@Type(() => Number)` | Cantidad en unidades de venta |
  | `discountAmount` | number | No | `@IsNumber()` | **Validado pero no consumido por el servicio** |

- **Respuesta**: `Sale` creado con `items`.
- **Errores**: ver "Errores de `createSale`".

### POST /api/sales/:id/cancel
- **Descripción**: Anula una venta completada (`status = CANCELLED`) y revierte el stock.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([sale:cancel])`.
- **Plan**: `@RequireModule('sales')`.
- **Guards extra**: ninguno (mutación → `Content-Type: application/json`).
- **Path params**: `id`. **Body (`CancelSaleDto`)**: `reason` (string, opcional) → se appendea a `sale.notes` con el prefijo `Anulacion: `.
- **Respuesta**: `Sale` actualizado con `items`, `customer` y `employee`.
- **Efectos secundarios** (transacción `maxWait 10s` / `timeout 15s`):
  1. Guard idempotente `updateMany({ id, companyId, status: COMPLETED }, { status: CANCELLED, notes })`; si `count !== 1` → 400 `La venta ya fue procesada.`
  2. Por cada item: `stockQuantity` incrementado en `quantity × factor` (presentación), `InventoryMovement` `RETURN` con nota `Anulacion de venta <saleNumber>` y asiento de kardex `recordInMovement` con `costPrice`.
  3. Auditoría `AuditAction.UPDATE` sobre `Sale` (`status`, `reason`, `saleNumber`).
- **Errores**: 404 `Venta no encontrada.`; 400 `Solo se pueden anular o reembolsar ventas completadas. Estado actual: <status>.`; 400 `La venta ya fue procesada.`; 404 si un producto del detalle ya no existe.
- **Nota**: **no se devuelve el uso del cupón** ni se restauran los lotes (`product_batches`) reservados; el stock se recupera igualmente porque `reserveFromBatch` crea un lote de apertura ante stock no rastreado.

### POST /api/sales/:id/refund
- Idéntico a `cancel`, pero con `status = REFUNDED` y prefijo de notas `Reembolso: `.
- **Auth**: mismos roles/permisos que cancel (`@Roles(['COMPANY_ADMIN','MANAGER'])` + `sale:cancel`).

## Flujo de creación de venta (canal POS/ONLINE) — `createSale`

1. **Rama distribuidor**: si `input.channel === 'DISTRIBUTOR'`, exige `distributorId` (si falta →
   400 `BadRequestException('Debe seleccionar un distribuidor para el canal Distribuidor.')`) y delega
   en `DistributorsService.registerSale(companyId, distributorId, { items: [{productId, quantity}], paymentMethod, taxAmount, discountAmount, customerId })`.
   En este canal no se descuenta stock de productos ni se crea kardex propio: la mercadería se descontó
   al transferirla al distribuidor y la venta solo actualiza `distributor_balances`
   (`soldQuantity` increment, `balanceQuantity` decrement, `debtAmount` increment). El `Sale` se crea
   con `channel = 'DISTRIBUTOR'` y `saleNumber = SALE-${Date.now()}`. Los precios se resuelven con
   `item.unitPrice ?? product.salePrice` y los items del mismo producto se fusionan.
2. **Carga de productos**: obtiene los productos de la empresa con sus presentaciones
   (`include: { presentations: true }`). Se deduplican los `productId` con un `Set`.
3. **Resolución de items**:
   - Producto inexistente en la empresa → 404 `NotFoundException('Product <id> not found.')`.
   - Si se envía `presentationId` y no pertenece al producto → 400 `BadRequestException('Presentation <id> not found.')`.
   - `factor` = `presentation.factor` o `1`; `quantity` = `input.quantity`;
     `baseQuantity = quantity * factor`; `unitPrice = presentation.price ?? product.salePrice`;
     `totalPrice = unitPrice * quantity`.
4. **Validación de stock**: agrega `baseQuantity` por producto; si `product.stockQuantity < baseQuantity`
   → 400 `BadRequestException('Stock insuficiente para <name>. Disponible: <n>, solicitado: <m>.')`.
 5. **Cálculo de importes**:
    - `subtotal` = suma de `totalPrice` de todos los items.
    - `taxAmount` = `input.taxAmount ?? 0`.
    - Descuento: si se envía `couponCode` **no puede** enviarse además `discountAmount > 0`
      (400 `BadRequestException`). El monto final lo fija la resolución del cupón (paso 7); si no hay
      cupón, `discountAmount = input.discountAmount ?? 0`.
    - `totalAmount = subtotal + taxAmount - discountAmount`.
    - `paidAmount = totalAmount` y `changeAmount = 0` (siempre; no hay manejo de pago parcial/vuelto).
    - `saleNumber = SALE-${Date.now()}-${aleatorio de 5 caracteres}` (canal POS/ONLINE). El modelo
      impone unicidad `(companyId, saleNumber)`; el sufijo aleatorio reduce (no elimina) la colisión de
      timestamp. En la rama `DISTRIBUTOR` el `saleNumber` lo genera `DistributorsService` como
      `SALE-${Date.now()}` sin sufijo.
 6. **Validación de referencias**: si `customerId`/`employeeId` se envían, deben existir en la empresa,
    si no → 404 `NotFoundException('Customer not found.')` / `('Employee not found.')`.
 7. **Transacción Prisma** (`{ maxWait: 10_000, timeout: 15_000 }`):
    - Si hay `couponCode`:
      - `assertDiscountsEnabled(companyId)` → 403 `FEATURE_NOT_AVAILABLE` (con `features`,
        `currentPlan`, `upgradeUrl`) si el plan no incluye `sales.discounts`.
      - `DiscountsService.resolveForSale(tx, companyId, couponCode, subtotal)` revalida el cupón con el
        subtotal real y hace `updateMany` condicionado para incrementar `usedCount` (si no queda cupo →
        400 `El cupon de descuento ya no tiene cupos disponibles.`).
      - `sale.couponId` queda persistido y `discountAmount` pasa a ser el monto resuelto.
      - El descuento manual también exige `assertDiscountsEnabled` aunque no lleve cupón.
    - Crea `Sale` (con `channel = input.channel ?? 'POS'`, `items: { create: itemsData }`) e `include items`.
    - Por cada item: `product.updateMany` condicionado por `(id, companyId, stockQuantity >= baseQuantity)`
      con `stockQuantity: { decrement: baseQuantity }`. Si `count !== 1` →
      400 `BadRequestException('Stock insuficiente para el producto <id>.')`.
    - Por cada item: `ProductBatchesService.reserveFromBatch(companyId, productId, baseQuantity, tx)`
      (FEFO; puede crear lotes de apertura y movimientos `ADJUSTMENT`).
    - Crea un `InventoryMovement` por item con `type: 'OUT'`, `quantity: baseQuantity.neg()`,
      `presentationId`, `notes: 'Sale <saleNumber>'`.
    - Por cada movimiento: `KardexService.recordOutMovement(companyId, productId, baseQuantity, movement.id, tx)`.
 8. **Auditoría** (fuera de la transacción): `AuditService.log({ companyId, action: CREATE, entity: 'Sale',
    entityId, changes: { saleNumber, subtotal, taxAmount, discountAmount, totalAmount, paymentMethod,
    customerId, employeeId, items[] } })`.
 9. **Notificación de stock bajo** (fuera de la transacción): por cada producto, `LowStockService.notifyIfLowStock`
    con `currentStock = product.stockQuantity - baseQuantity`, `previousStock = product.stockQuantity`,
    `minStock` y `baseUnit`.
 10. **Devuelve**: el `Sale` creado.

### Reversión de ventas (`reverseSale`, usado por cancel y refund)

1. `findFirst({ id, companyId, include: { items: true } })` → 404 `Venta no encontrada.` si no pertenece.
2. Si `sale.status !== COMPLETED` → 400 `Solo se pueden anular o reembolsar ventas completadas. Estado actual: <status>.`
3. Transacción: guard `updateMany({ id, companyId, status: COMPLETED }, { status: targetStatus, notes })`
   (si `count !== 1` → 400 `La venta ya fue procesada.`), y por cada item:
   - `product.update({ stockQuantity: { increment: quantity × factor } })`,
   - `InventoryMovement` `RETURN` con nota `Anulacion de venta <saleNumber>` / `Reembolso de venta <saleNumber>`,
   - `KardexService.recordInMovement(...)` con `costPrice`.
4. Auditoría `AuditAction.UPDATE` sobre `Sale` (`status`, `reason`, `saleNumber`).

## Gating de descuento (`sales.discounts`)

`SalesService.assertDiscountsEnabled(companyId)` se invoca **solo cuando la venta lleva descuento**
(`couponCode` presente o `discountAmount > 0`). Lanza 403 con `error: 'FEATURE_NOT_AVAILABLE'`,
`features`, `currentPlan` y `upgradeUrl: '/subscription'` si el plan no incluye `sales.discounts`.
Como los cuatro planes incluyen la feature, en la práctica ninguna venta se bloquea; el guard de clase
`PlanCapabilitiesGuard` solo aplica `@RequireModule('sales')`, nunca `@RequireFeature` a nivel endpoint,
para no impedir ventas normales.

## Funciones del servicio (`SalesService`)

### `findRecentSales(companyId, query)`
- **Qué hace**: ventas de la empresa con proyección reducida, `createdAt` desc, paginadas con
  `page` (def. 1) y `limit` (def. 20, máx 100).
- **Escribe en**: nada.
- **Devuelve**: array (ver endpoint `GET /api/sales`).
- **Lanza**: nada.

### `findById(companyId, id)`
- **Qué hace**: busca la venta por `(id, companyId)` con cliente, empleado, cupón e items.
- **Escribe en**: nada.
- **Devuelve**: `Sale`.
- **Lanza**: 404 `NotFoundException('Venta no encontrada.')`.

### `cancelSale(companyId, id, userId?, reason?)` / `refundSale(...)`
- **Qué hace**: delega en `reverseSale` con `SaleStatus.CANCELLED` / `SaleStatus.REFUNDED`.
- **Escribe en**: `sales` (status + notes), `products` (`stockQuantity` increment), `inventory_movements`
  (`RETURN`), `inventory_kardex`; auditoría (`Sale`).
- **Devuelve**: `Sale` con `items`, `customer` y `employee`.
- **Lanza**: 404, 400 (estado no `COMPLETED`, ya procesada), 404 de producto faltante.

### `exportSales(companyId, query)`
- **Qué hace**: arma el `where` (fechas, `status`, `customerId`, `channel`) y trae las ventas con
  cliente, empleado e items (con producto completo). Según `format` llama a un generador privado.
- **Escribe en**: nada.
- **Devuelve**: `{ filename, contentType, data }` (base64).
- **Lanza**: nada.
- **Privados**: `generateCsvExport`, `generateExcelExport`, `generatePdfExport`.

### `createSale(companyId, input)`
- **Qué hace**: flujo descrito arriba.
- **Escribe en**: `sales`, `sale_items`, `products` (decrement `stockQuantity`),
  `product_batches` (reserva FEFO / lote de apertura), `inventory_movements`, `inventory_kardex`,
  `discount_coupons` (`usedCount` + `couponId` en la venta);
  en la rama distribuidor: `sales`, `sale_items`, `distributor_balances`; auditoría (`Sale`);
  notificaciones `LOW_STOCK`.
- **Devuelve**: `Sale` creado (con `items`).
- **Lanza**: 400 `BadRequestException` (distribuidor faltante, presentación inválida, stock insuficiente),
  404 `NotFoundException` (producto, cliente o empleado no encontrados); errores de las estrategias de
  kardex y de `reserveFromBatch` según corresponda.

## Comportamiento esperado (según `sales.service.spec.ts`)

- `createSale` crea la venta sin lanzar el error de referencia TDZ (temporal dead zone).
- Rechaza items de otro tenant: el `findMany` de productos está acotado a `companyId`, por lo que un
  producto de otra empresa se reporta como no encontrado (`/not found/i`).
- El spec instancia `SalesService` sin el último argumento (`distributorsService`); esto solo importa
  en la rama `channel = 'DISTRIBUTOR'`.

## No verificado en el código

- `@LimitResource` no está aplicado en el controller de `sales`, aunque `sales` figure entre los
  recursos validables por `SubscriptionLimitGuard` según `roles-permisos-planes.md`.
- `NotificationsService` y `NotificationType` se inyectan/importan en `SalesService` pero no se usan en
  ningún método de la clase.
- `CreateSaleItemDto.discountAmount` se valida pero no se consume: el descuento a nivel de item no se
  aplica al `totalPrice` ni al `subtotal`.
- No se revierte el uso de un cupón al anular/reembolsar: `discount_coupons.usedCount` queda consumido
  de forma permanente tras una venta que luego se anula.
- No se restauran los lotes (`product_batches.quantityAvailable`) en la reversión; el stock se devuelve
  al producto base y `reserveFromBatch` re-crea un lote de apertura si hace falta.
- El manejo del error de unicidad `(companyId, saleNumber)` en la creación de ventas no está capturado
  de forma específica (el sufijo aleatorio solo reduce la probabilidad de colisión).
- La devolución de mercadería de un distribuidor (`returnGoods`, con `InventoryMovement` `RETURN` y
  `KardexService.recordInMovement`) sigue siendo un flujo distinto del reverso de venta.
