# Módulo: product-batches

## Propósito

Gestiona lotes de producto (`ProductBatch`): alta, consulta, actualización, borrado y reserva de
disponibilidad por lote. Es parte del inventario y requiere la feature de plan
`inventory.batches`.

## Archivos clave

- `backend/src/modules/product-batches/product-batches.controller.ts` — rutas de lotes y reserva.
- `backend/src/modules/product-batches/product-batches.service.ts` — lógica de lotes, FEFO y reservas.
- `backend/src/modules/product-batches/dto/product-batch.dto.ts` — DTOs de creación/actualización/reserva/consulta.
- `backend/src/modules/product-batches/product-batches.module.ts` — importa `PrismaModule`.

## Autorización a nivel de controlador

- `@Controller('product-batches')` → base real `/api/product-batches`.
- Guards de clase: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`.
- `@RequireModule('inventory')` a nivel de clase.
- `@RequireFeature('inventory.batches')` a nivel de clase → gating `FEATURE_NOT_AVAILABLE` (403) si el plan no la incluye.
- Guards globales: `CsrfGuard` (mutaciones), `ThrottlerGuard`.

## Endpoints

### GET /api/product-batches
- **Descripción**: Lista lotes de la empresa, con filtros opcionales por producto y sucursal.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:view])`.
- **Plan**: `@RequireModule('inventory')` + `@RequireFeature('inventory.batches')`.
- **Query (DTO `QueryProductBatchDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `productId` | string | No | `@IsString()` | Filtra por producto |
  | `branchId` | string | No | `@IsString()` | Filtra por sucursal |

- **Respuesta**: array de `ProductBatch` con `product {name, sku}`, ordenado por `expirationDate` asc.
- **Efectos secundarios**: solo lectura.

### GET /api/product-batches/expiring
- **Descripción**: Lista lotes con `expirationDate` no nula y `<= hoy + days`, con `quantityAvailable > 0`.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:view])`.
- **Plan**: `@RequireModule('inventory')` + `@RequireFeature('inventory.batches')`.
- **Query**: `days` (string, opcional; por defecto 7). Se convierte con `Number(days)` si se envía.
- **Respuesta**: array de `ProductBatch` con `product {name, sku}`, ordenado por `expirationDate` asc.
- **Efectos secundarios**: solo lectura.
- **Nota**: `days` no está declarado en un DTO con validación (llega como `@Query('days')` crudo).

### GET /api/product-batches/:id
- **Descripción**: Obtiene un lote por id.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:view])`.
- **Path params**: `id`.
- **Respuesta**: `ProductBatch` con `product {name, sku}` y `branch {name}`.
- **Errores**: 404 `NotFoundException` si no existe en la empresa.

### POST /api/product-batches
- **Descripción**: Crea un lote de producto.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:inbound])`.
- **Plan**: `@RequireModule('inventory')` + `@RequireFeature('inventory.batches')`.
- **Body (DTO `CreateProductBatchDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `productId` | string | Sí | `@IsString()` | Producto (se valida en la empresa) |
  | `batchNumber` | string | Sí | `@IsString()` | Número de lote |
  | `quantityReceived` | number | Sí | `@IsInt()`, `@Min(1)` | Cantidad recibida |
  | `quantityAvailable` | number | Sí | `@IsInt()`, `@Min(0)` | Cantidad disponible |
  | `purchasePrice` | number | Sí | `@Type(() => Number)` | Precio de compra |
  | `branchId` | string | No | `@IsString()` | Sucursal (se valida en la empresa) |
  | `expirationDate` | string (date) | No | `@IsDateString()` | Fecha de vencimiento (se guarda como `Date` o `null`) |

- **Respuesta**: `ProductBatch` creado.
- **Efectos secundarios**: escribe `product_batches`. No crea `inventory_movements` ni kardex, ni audita.
- **Errores**: 404 `NotFoundException` si el producto o la sucursal no existen.

### PATCH /api/product-batches/:id
- **Descripción**: Actualiza campos de un lote (disponibilidad, precio, vencimiento).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:adjust])`.
- **Path params**: `id`.
- **Body (DTO `UpdateProductBatchDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `quantityAvailable` | number | No | `@IsInt()`, `@Min(0)` | Nueva disponibilidad |
  | `purchasePrice` | number | No | `@Type(() => Number)` | Nuevo precio de compra |
  | `expirationDate` | string (date) | No | `@IsDateString()` | Nueva fecha de vencimiento |

- **Respuesta**: el lote re-consultado (`findById`).
- **Efectos secundarios**: escribe `product_batches` (solo campos enviados). No audita.
- **Errores**: 404 si no existe (count 0).

### DELETE /api/product-batches/:id
- **Descripción**: Elimina (borrado físico) un lote sin disponibilidad.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:adjust])`.
- **Path params**: `id`.
- **Respuesta**: `{ deleted: true }`.
- **Efectos secundarios**: borra de `product_batches`.
- **Errores**: 404 si no existe; 400 `BadRequestException` si `quantityAvailable > 0`.

### POST /api/product-batches/:id/reserve
- **Descripción**: Reserva una cantidad del lote decrementando `quantityAvailable`.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:outbound])`.
- **Path params**: `id` (lote).
- **Body (DTO `ReserveBatchDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `quantity` | number | Sí | `@IsInt()`, `@IsPositive()` | Cantidad a reservar |

- **Respuesta**: el lote re-consultado (`findById`).
- **Efectos secundarios**: escribe `product_batches` (`quantityAvailable` decrement). No audita. No crea movimientos ni kardex.
- **Errores**: 404 si el lote no existe; 400 si `quantityAvailable < quantity` o si la actualización condicional no afectó filas (`La disponibilidad del lote cambió...`).

## Funciones del servicio (`ProductBatchesService`)

### `create(companyId, dto)`
- **Qué hace**: valida producto y sucursal (si hay) y crea el lote.
- **Escribe en**: `product_batches`.
- **Devuelve**: `ProductBatch`.
- **Lanza**: 404 si producto o sucursal no existen.

### `findAll(companyId, query)`
- **Qué hace**: lista lotes filtrando por `productId`/`branchId`.
- **Escribe en**: nada.
- **Devuelve**: array de `ProductBatch` con `product`.
- **Lanza**: nada.

### `findById(companyId, id)`
- **Qué hace**: busca el lote con `product` y `branch`.
- **Devuelve**: `ProductBatch`.
- **Lanza**: 404 si no existe.

### `update(companyId, id, dto)`
- **Qué hace**: actualiza `quantityAvailable`/`purchasePrice`/`expirationDate` mediante `updateMany` condicionado por empresa.
- **Escribe en**: `product_batches`.
- **Devuelve**: el lote re-consultado.
- **Lanza**: 404 si no existe (count 0).

### `remove(companyId, id)`
- **Qué hace**: valida existencia y que no quede disponibilidad; borra.
- **Escribe en**: borra de `product_batches`.
- **Devuelve**: `{ deleted: true }`.
- **Lanza**: 404 si no existe; 400 si `quantityAvailable > 0`.

### `findExpiring(companyId, days = 7)`
- **Qué hace**: calcula el umbral `hoy + days` y lista lotes por vencer con disponibilidad.
- **Devuelve**: array de `ProductBatch` con `product`.
- **Lanza**: nada.

### `findEarliestBatch(companyId, productId, quantity, tx?)`
- **Qué hace**: busca el primer lote (FEFO) con disponibilidad suficiente: primero con `expirationDate` no nula orden asc; si no, lotes sin vencimiento por `createdAt` asc.
- **Escribe en**: nada (solo lectura, opcionalmente dentro de `tx`).
- **Devuelve**: `ProductBatch` o `null`.
- **Lanza**: nada.

### `reserveFromBatch(companyId, productId, quantity, tx)`
- **Qué hace**: descuenta `quantity` de lotes del producto en orden FEFO dentro de una transacción. Antes de descontar, calcula el stock "no rastreado" (`stockBeforeSale = stock + quantity` menos la suma de `quantityAvailable` de lotes); si es positivo, crea un lote de apertura (`OPENING-<productId>-<timestamp>`) y un `InventoryMovement` de tipo `ADJUSTMENT` (`reason: 'Legacy stock batch reconciliation'`) para reconciliar el stock heredado. Luego descuenta iterando lotes; si no alcanza, lanza error.
- **Escribe en**: `product_batches` (crea lote de apertura/actualiza `quantityAvailable`), `inventory_movements` (posible `ADJUSTMENT`).
- **Devuelve**: `void`.
- **Lanza**: 404 si el producto no existe; 400 `BadRequestException` si el stock en lotes es insuficiente.
- **Nota**: es un método de uso interno (invocado desde ventas, no expuesto por estos endpoints).

### `reserveBatch(companyId, id, dto)`
- **Qué hace**: valida el lote y su disponibilidad y decrementa `quantityAvailable` de forma condicional.
- **Escribe en**: `product_batches`.
- **Devuelve**: el lote re-consultado.
- **Lanza**: 404 si no existe; 400 si la cantidad excede la disponibilidad o si cambió la disponibilidad (count 0).

## No verificado en el código

- No hay endpoint de auditoría para lotes: el servicio `ProductBatchesService` no inyecta `AuditService` ni llama a `AuditService.log`.
- No se expone endpoint para `findEarliestBatch`/`reserveFromBatch`; se usan internamente (consumidor no inspeccionado en este documento).
- El DTO `CreateProductBatchDto`/`UpdateProductBatchDto` no valida `purchasePrice` con `@IsNumber()`, solo aplica `@Type(() => Number)`.
