# Módulo: Distributors

## Propósito
Administra distribuidores y su operación de campo: transferencia de mercadería desde la empresa al
distribuidor, registro de ventas reportadas, devolución de mercadería, entregas y liquidación de deuda,
manteniendo el `DistributorBalance` (mercadería en poder del distribuidor y deuda acumulada).

## Archivos clave
- `backend/src/modules/distributors/distributors.controller.ts` — rutas HTTP, guards, roles y permisos.
- `backend/src/modules/distributors/distributors.service.ts` — lógica de negocio y transacciones (`transfer`, `returnGoods`, `registerSale`, `settle`, etc.).
- `backend/src/modules/distributors/dto/distributor.dto.ts` — DTOs de creación, actualización, movimiento de stock, venta, entrega, liquidación y query.
- `backend/src/modules/distributors/distributors.module.ts` — importa `PrismaModule`, `KardexModule`, `LowStockModule`, `ProductBatchesModule`.
- `backend/src/modules/distributors/distributors.service.spec.ts` — pruebas de aislamiento por tenant, transferencia, venta y liquidación.

## Endpoints

Guards a nivel de controlador: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)` y
`@RequireModule('distributors')`. El `tenantId` proviene del guard (`request.tenantId`).

### GET /api/distributors
- **Descripción**: Lista distribuidores activos (no eliminados) con su `balance`.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:list])`.
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Query (DTO `QueryDistributorsDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `status` | string | no | `@IsIn(['ACTIVE','SUSPENDED','BLOCKED'])` | Filtra por estado. |
| `search` | string | no | `@IsString()` | Búsqueda por `code`, `name` o `documentValue` (insensible a mayúsculas). |

- **Respuesta**: array de distribuidores, cada uno con `balance` (o `null`).
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards; 400 validación de query.

### POST /api/distributors
- **Descripción**: Crea un distribuidor y su `DistributorBalance` inicial vacío.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:create])`.
- **Plan**: `@RequireModule('distributors')`. Sin guard de límite de recurso.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Body (DTO `CreateDistributorDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `code` | string | sí | `@IsString()`, `@MaxLength(40)` | Código único por empresa. |
| `name` | string | sí | `@IsString()`, `@MaxLength(160)` | Nombre. |
| `type` | string | no | `@IsIn(['INDIVIDUAL','COMPANY'])` | Tipo (defecto `INDIVIDUAL`). |
| `documentType` | string | no | `@IsString()`, `@MaxLength(20)` | Tipo de documento. |
| `documentValue` | string | no | `@IsString()`, `@MaxLength(30)` | Número de documento. |
| `email` | string | no | `@IsEmail()` | Correo. |
| `phone` | string | no | `@IsString()`, `@MaxLength(30)` | Teléfono. |
| `address` | string | no | `@IsString()`, `@MaxLength(200)` | Dirección. |
| `commissionRate` | number | no | `@IsNumber()`, `@Min(0)`, `@Type(() => Number)` | Tasa de comisión. |
| `priceListId` | string | no | `@IsString()` | Lista de precios. |
| `notes` | string | no | `@IsString()`, `@MaxLength(500)` | Notas. |

- **Respuesta**: el `Distributor` creado con `balance`.
- **Efectos secundarios**: escribe `distributors` y `distributor_balances` (creación anidada); auditoría (`action: CREATE`, `entity: 'Distributor'`).
- **Errores**: 409 `Ya existe un distribuidor con ese codigo.`; 400 validación.

### GET /api/distributors/:id
- **Descripción**: Obtiene un distribuidor por id (no eliminado) con su `balance`.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:view])`.
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |

- **Respuesta**: `Distributor` con `balance`.
- **Efectos secundarios**: ninguno.
- **Errores**: 404 `Distribuidor no encontrado.`

### PATCH /api/distributors/:id
- **Descripción**: Actualiza campos del distribuidor (incluye `status`).
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:update])`.
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body (DTO `UpdateDistributorDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |
| `code` | string | no | `@IsString()`, `@MaxLength(40)` | Código único. |
| `name` | string | no | `@IsString()`, `@MaxLength(160)` | Nombre. |
| `type` | string | no | `@IsIn(['INDIVIDUAL','COMPANY'])` | Tipo. |
| `status` | string | no | `@IsIn(['ACTIVE','SUSPENDED','BLOCKED'])` | Estado. |
| `documentType` | string | no | `@IsString()`, `@MaxLength(20)` | Tipo de documento. |
| `documentValue` | string | no | `@IsString()`, `@MaxLength(30)` | Número de documento. |
| `email` | string | no | `@IsEmail()` | Correo. |
| `phone` | string | no | `@IsString()`, `@MaxLength(30)` | Teléfono. |
| `address` | string | no | `@IsString()`, `@MaxLength(200)` | Dirección. |
| `commissionRate` | number | no | `@IsNumber()`, `@Min(0)`, `@Type(() => Number)` | Comisión. |
| `priceListId` | string | no | `@IsString()` | Lista de precios. |
| `notes` | string | no | `@IsString()`, `@MaxLength(500)` | Notas. |

- **Respuesta**: `Distributor` actualizado con `balance`.
- **Efectos secundarios**: escribe `distributors`; auditoría (`action: UPDATE`).
- **Errores**: 404 `Distribuidor no encontrado.`; 409 `Ese codigo ya esta en uso.` si el `code` cambia y colisiona; 400 validación.

### DELETE /api/distributors/:id
- **Descripción**: Elimina (lógicamente) un distribuidor solo si no tiene mercadería ni deuda pendiente.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN'])`, `@Permissions([distributor:delete])`.
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |

- **Respuesta**: `{ deleted: true }`.
- **Efectos secundarios**: escribe `distributors` (`deletedAt`); auditoría (`action: DELETE`).
- **Errores**: 404 `Distribuidor no encontrado.`; 400 `No se puede eliminar un distribuidor con mercaderia o deuda pendiente.`

### GET /api/distributors/:id/balance
- **Descripción**: Devuelve el `DistributorBalance`; si no existe, uno por defecto en ceros.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:view])`.
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |

- **Respuesta**: `DistributorBalance` (`distributorId, startingQuantity, returnedQuantity, soldQuantity, balanceQuantity, debtAmount`).
- **Efectos secundarios**: ninguno.
- **Errores**: 404 `Distribuidor no encontrado.`

### POST /api/distributors/:id/transfers
- **Descripción**: Transfiere mercadería de la empresa al distribuidor (`transferStock`). Descuenta stock del producto, reserva de lotes, crea movimiento `TRANSFER` y kardex de salida, e incrementa el saldo del distribuidor.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:transfer])`.
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body (DTO `MoveDistributorStockDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |
| `items` | array | sí | `@ArrayMinSize(1)`, `@ValidateNested({ each: true })` | Ítems de stock. |
| `items[].productId` | string | sí | `@IsString()` | Producto (de la misma empresa). |
| `items[].quantity` | number | sí | `@IsInt()`, `@Min(1)` | Cantidad entera ≥ 1. |
| `notes` | string | no | `@IsString()`, `@MaxLength(500)` | Notas (defecto interno: "Transferencia a distribuidor"). |

- **Respuesta**: `{ distributorId, transferredQuantity, balance }`.
- **Efectos secundarios**: `products.stockQuantity` decrementa; `product_batches` reserva; `inventory_movements` (`type: TRANSFER`, `quantity` negativo, `distributorId`); `inventory_kardex` (movimiento de salida); `distributor_balances` upsert (`startingQuantity` y `balanceQuantity` incrementan); notificaciones de bajo stock; auditoría (`action: UPDATE`, `entity: 'Distributor'`, `changes.operation: 'TRANSFER'`).
- **Errores**: 404 `Distribuidor no encontrado.`; 404 `Producto {id} no encontrado.`; 400 `El distribuidor no esta activo.`; 400 `Stock insuficiente para {nombre}.` / `Stock insuficiente para el producto {id}.` (condición de carrera en `updateMany`).

### POST /api/distributors/:id/returns
- **Descripción**: Registra la devolución de mercadería del distribuidor a la empresa. Incrementa stock del producto, crea movimiento `RETURN` y kardex de entrada, y ajusta saldo.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:transfer])`.
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body (DTO `MoveDistributorStockDto`)**: igual estructura que en `transfers`.

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |
| `items` | array | sí | `@ArrayMinSize(1)`, `@ValidateNested({ each: true })` | Ítems devueltos. |
| `items[].productId` | string | sí | `@IsString()` | Producto. |
| `items[].quantity` | number | sí | `@IsInt()`, `@Min(1)` | Cantidad ≥ 1. |
| `notes` | string | no | `@IsString()`, `@MaxLength(500)` | Notas (defecto interno: "Devolucion de distribuidor"). |

- **Respuesta**: `{ balance }`.
- **Efectos secundarios**: `products.stockQuantity` incrementa; `inventory_movements` (`type: RETURN`, `quantity` positivo); `inventory_kardex` (movimiento de entrada con `costPrice` del producto); `distributor_balances` (`returnedQuantity` incrementa, `balanceQuantity` decrementa); auditoría (`changes.operation: 'RETURN'`).
- **Errores**: 404 `Distribuidor no encontrado.`; 404 `Producto {id} no encontrado.`; 400 `El distribuidor no tiene mercaderia suficiente para devolver.`

### GET /api/distributors/:id/sales
- **Descripción**: Lista las ventas (canal `DISTRIBUTOR`) del distribuidor (máximo 100).
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:view])`.
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |

- **Respuesta**: array de `Sale` con `items` y `items.product { name, sku }`.
- **Efectos secundarios**: ninguno.
- **Errores**: 404 `Distribuidor no encontrado.`

### POST /api/distributors/:id/sales
- **Descripción**: Registra una venta reportada por el distribuidor. Crea una `Sale` de canal `DISTRIBUTOR`, descuenta saldo de mercadería y acumula deuda.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:deliver])` (`DISTRIBUTOR_DELIVERY`).
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body (DTO `RegisterDistributorSaleDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |
| `items` | array | sí | `@ArrayMinSize(1)`, `@ValidateNested({ each: true })` | Ítems vendidos. |
| `items[].productId` | string | sí | `@IsString()` | Producto. |
| `items[].quantity` | number | sí | `@IsInt()`, `@Min(1)` | Cantidad ≥ 1. |
| `items[].unitPrice` | number | no | `@IsNumber()`, `@Min(0)`, `@Type(() => Number)` | Precio unitario (defecto `product.salePrice`). |
| `paymentMethod` | string | sí | `@IsIn(['CASH','CARD','TRANSFER'])` | Forma de pago. |
| `taxAmount` | number | no | `@IsNumber()`, `@Min(0)`, `@Type(() => Number)` | Impuesto (defecto 0). |
| `discountAmount` | number | no | `@IsNumber()`, `@Min(0)`, `@Type(() => Number)` | Descuento (defecto 0). |
| `customerId` | string | no | `@IsString()` | Cliente. |
| `notes` | string | no | `@IsString()`, `@MaxLength(500)` | Notas. |

- **Respuesta**: la `Sale` creada (con `items`). `saleNumber` se genera como `SALE-<timestamp>`; `totalAmount = subtotal + taxAmount - discountAmount`; `paidAmount = totalAmount`.
- **Efectos secundarios**: escribe `sales` y `sale_items`; `distributor_balances` (`soldQuantity` incrementa, `balanceQuantity` decrementa, `debtAmount` incrementa); auditoría (`action: CREATE`, `entity: 'Sale'`).
- **Errores**: 404 `Distribuidor no encontrado.`; 404 `Producto {id} no encontrado.`; 400 `El distribuidor no tiene mercaderia suficiente para reportar esa venta.`

### GET /api/distributors/:id/deliveries
- **Descripción**: Lista las entregas del distribuidor (máximo 100).
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:deliver])` (`DISTRIBUTOR_DELIVERY`).
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |

- **Respuesta**: array de `DistributorDelivery`.
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards. No valida existencia del distribuidor (`findDeliveries` no llama a `getDistributorOrFail`).

### POST /api/distributors/:id/deliveries
- **Descripción**: Crea una entrega (`DistributorDelivery`).
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([distributor:deliver])` (`DISTRIBUTOR_DELIVERY`).
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body (DTO `CreateDistributorDeliveryDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |
| `items` | array | sí | `@ArrayMinSize(1)`, `@ValidateNested({ each: true })` | Ítems (reutiliza `DistributorStockItemDto`). |
| `items[].productId` | string | sí | `@IsString()` | Producto. |
| `items[].quantity` | number | sí | `@IsInt()`, `@Min(1)` | Cantidad ≥ 1. |
| `status` | string | no | `@IsIn(['PENDING','DELIVERED','CANCELLED'])` | Estado (defecto `PENDING`). |
| `amount` | number | no | `@IsNumber()`, `@Min(0)`, `@Type(() => Number)` | Importe. |
| `notes` | string | no | `@IsString()`, `@MaxLength(500)` | Notas. |

- **Respuesta**: la `DistributorDelivery` creada. `deliveryNumber` se genera como `DEL-<timestamp>`; `deliveryDate` se fija a la fecha actual.
- **Efectos secundarios**: escribe `distributor_deliveries` (los `items` se guardan como `Json`); auditoría (`action: CREATE`, `entity: 'DistributorDelivery'`). No afecta stock ni saldo.
- **Errores**: 404 `Distribuidor no encontrado.`; 400 validación.

### POST /api/distributors/:id/settlements
- **Descripción**: Liquida (paga) deuda del distribuidor, reduciendo `debtAmount`.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN'])`, `@Permissions([distributor:settle])`.
- **Plan**: `@RequireModule('distributors')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body (DTO `SettleDistributorDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del distribuidor. |
| `amount` | number | sí | `@IsNumber()`, `@Min(0.01)`, `@Type(() => Number)` | Monto a liquidar. |
| `notes` | string | no | `@IsString()`, `@MaxLength(500)` | Notas. |

- **Respuesta**: el `DistributorBalance` actualizado.
- **Efectos secundarios**: `distributor_balances.debtAmount` decrementa; auditoría (`action: UPDATE`, `changes.operation: 'SETTLEMENT'`).
- **Errores**: 404 `Distribuidor no encontrado.`; 400 `El distribuidor no tiene saldo registrado.`; 400 `El monto excede la deuda pendiente.`

## Funciones del servicio (`DistributorsService`)

### `mergeItems(items)` (privado)
- **Qué hace**: agrupa ítems por `productId` sumando cantidades.
- **Escribe en**: nada.
- **Devuelve**: array `{ productId, quantity }` consolidado.
- **Lanza**: nada.

### `withBalance(row)` (privado)
- **Qué hace**: aplana `balances[0]` a `balance` (o `null`).
- **Escribe en**: nada.
- **Devuelve**: objeto sin `balances` y con `balance`.
- **Lanza**: nada.

### `getDistributorOrFail(companyId, id)` (privado)
- **Qué hace**: busca distribuidor no eliminado con `balances`.
- **Escribe en**: nada.
- **Devuelve**: distribuidor con `balance` aplanado.
- **Lanza**: `NotFoundException('Distribuidor no encontrado.')`.

### `findAll(companyId, query)`
- **Qué hace**: lista distribuidores no eliminados con filtros de `status` y `search`.
- **Escribe en**: nada.
- **Devuelve**: array con `balance`.
- **Lanza**: nada.

### `create(companyId, dto)`
- **Qué hace**: valida `code` único; crea distribuidor con `balances: { create: {} }`.
- **Escribe en**: `distributors`, `distributor_balances`; auditoría.
- **Devuelve**: distribuidor con `balance`.
- **Lanza**: `ConflictException('Ya existe un distribuidor con ese codigo.')`; errores Prisma.

### `update(companyId, id, dto)`
- **Qué hace**: obtiene distribuidor; si cambia `code`, verifica colisión; actualiza campos definidos.
- **Escribe en**: `distributors`; auditoría.
- **Devuelve**: distribuidor con `balance`.
- **Lanza**: `NotFoundException`, `ConflictException('Ese codigo ya esta en uso.')`, errores Prisma.

### `remove(companyId, id)`
- **Qué hace**: obtiene distribuidor; bloquea si `balanceQuantity > 0` o `debtAmount > 0`; si no, `deletedAt`.
- **Escribe en**: `distributors`; auditoría.
- **Devuelve**: `{ deleted: true }`.
- **Lanza**: `NotFoundException`; `BadRequestException('No se puede eliminar un distribuidor con mercaderia o deuda pendiente.')`.

### `findOne(companyId, id)`
- **Qué hace**: delega en `getDistributorOrFail`.
- **Escribe en**: nada.
- **Devuelve**: distribuidor con `balance`.
- **Lanza**: `NotFoundException`.

### `getBalance(companyId, id)`
- **Qué hace**: obtiene distribuidor y devuelve su balance o un balance en ceros.
- **Escribe en**: nada.
- **Devuelve**: `DistributorBalance`.
- **Lanza**: `NotFoundException`.

### `transfer(companyId, id, dto)`
- **Qué hace**: `transferStock`. Valida distribuidor activo; consolida ítems; valida productos de la empresa y stock suficiente; en transacción decrementa `stockQuantity` (con `gte` para evitar carreras), reserva de lotes, crea movimientos `TRANSFER` (cantidad negativa) con kardex de salida, y hace upsert del balance incrementando `startingQuantity` y `balanceQuantity`. Tras la transacción dispara avisos de bajo stock.
- **Escribe en**: `products`, `product_batches`, `inventory_movements`, `inventory_kardex`, `distributor_balances`; notificaciones (`LowStockService`); auditoría. Transacción con `maxWait: 10s`, `timeout: 15s`.
- **Devuelve**: `{ distributorId, transferredQuantity, balance }`.
- **Lanza**: `BadRequestException('El distribuidor no esta activo.')`; `NotFoundException('Producto {id} no encontrado.')`; `BadRequestException('Stock insuficiente para {name}.')`; `BadRequestException('Stock insuficiente para el producto {id}.')`.

### `returnGoods(companyId, id, dto)`
- **Qué hace**: consolida ítems; valida productos; valida que `balanceQuantity >= totalQuantity`; en transacción incrementa stock, crea movimientos `RETURN` (cantidad positiva) con kardex de entrada (`costPrice` como costo unitario), y actualiza balance (`returnedQuantity` incrementa, `balanceQuantity` decrementa).
- **Escribe en**: `products`, `inventory_movements`, `inventory_kardex`, `distributor_balances`; auditoría. Transacción con `maxWait: 10s`, `timeout: 15s`.
- **Devuelve**: `{ balance }`.
- **Lanza**: `NotFoundException('Distribuidor no encontrado.')`; `NotFoundException('Producto {id} no encontrado.')`; `BadRequestException('El distribuidor no tiene mercaderia suficiente para devolver.')`.

### `findSales(companyId, id)`
- **Qué hace**: valida distribuidor y lista ventas canal `DISTRIBUTOR` con `items.product`.
- **Escribe en**: nada.
- **Devuelve**: array de `Sale`.
- **Lanza**: `NotFoundException`.

### `registerSale(companyId, id, dto)`
- **Qué hace**: valida distribuidor; valida productos; consolida ítems y usa `unitPrice` recibido o `salePrice`; valida `balanceQuantity >= totalQuantity`; calcula subtotal/tax/discount/total; en transacción crea `Sale` (canal `DISTRIBUTOR`, `paidAmount = totalAmount`, `changeAmount = 0`) y actualiza balance (`soldQuantity` incrementa, `balanceQuantity` decrementa, `debtAmount` incrementa).
- **Escribe en**: `sales`, `sale_items`, `distributor_balances`; auditoría (`entity: 'Sale'`). Transacción con `maxWait: 10s`, `timeout: 15s`.
- **Devuelve**: `Sale` creada con `items`.
- **Lanza**: `NotFoundException`; `BadRequestException('El distribuidor no tiene mercaderia suficiente para reportar esa venta.')`.

### `findDeliveries(companyId, id)`
- **Qué hace**: lista entregas del distribuidor (máximo 100).
- **Escribe en**: nada.
- **Devuelve**: array de `DistributorDelivery`.
- **Lanza**: nada (no valida existencia del distribuidor).

### `createDelivery(companyId, id, dto)`
- **Qué hace**: valida distribuidor; crea entrega con `deliveryNumber` `DEL-<timestamp>`, `deliveryDate` actual, `items` como `Json`.
- **Escribe en**: `distributor_deliveries`; auditoría.
- **Devuelve**: `DistributorDelivery`.
- **Lanza**: `NotFoundException`.

### `settle(companyId, id, dto)`
- **Qué hace**: valida distribuidor; en transacción lee `debtAmount`, valida que no falte saldo y que `amount <= debt`, y decrementa la deuda.
- **Escribe en**: `distributor_balances`; auditoría.
- **Devuelve**: `DistributorBalance` actualizado.
- **Lanza**: `NotFoundException`; `BadRequestException('El distribuidor no tiene saldo registrado.')`; `BadRequestException('El monto excede la deuda pendiente.')`.

## Manejo de `DistributorBalance`
- Se crea vacío junto con el distribuidor (`create`) y se mantiene por operación:
  - `transfer`: `startingQuantity += total` y `balanceQuantity += total`.
  - `returnGoods`: `returnedQuantity += total` y `balanceQuantity -= total`.
  - `registerSale`: `soldQuantity += total`, `balanceQuantity -= total`, `debtAmount += totalAmount`.
  - `settle`: `debtAmount -= amount`.
- Invariante de control efectivo que se valida en el servicio: `balanceQuantity` acota `returnGoods` y `registerSale`; `debtAmount` acota `settle`; y `remove` exige `balanceQuantity == 0` y `debtAmount <= 0`.

## Pruebas (`distributors.service.spec.ts`)
- `transfer`: rechaza productos de otro tenant (búsqueda scopeada por `companyId`); rechaza stock insuficiente; decrementa stock, registra `TRANSFER` (cantidad negativa), kardex y upsert de saldo.
- `registerSale`: rechaza si el saldo del distribuidor es insuficiente; crea venta canal `DISTRIBUTOR`, con `distributorId`, `saleNumber` `SALE-...` y `soldQuantity.increment`.
- `settle`: rechaza una liquidación mayor a la deuda pendiente.

## Observaciones
- El módulo no aplica `@LimitResource` ni `SubscriptionLimitGuard` (el límite derivado `maxEmployees`/`maxProducts` no incluye distribuidores).
- No verificado en el código una validación de que `items[].productId` de `returnGoods` pertenezca al saldo transferido históricamente: la validación es de saldo agregado (`balanceQuantity`), no por producto.
- No verificado el comportamiento de `Distributor.userId` (acceso opcional de distribuidor) a nivel de endpoints: este controlador exige roles de empresa y no expone una ruta propia para el rol `DISTRIBUTOR`.
