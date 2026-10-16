# Módulo: inventory

## Propósito

Expone el inventario general de la empresa: consulta de movimientos, productos con stock bajo y
ajustes manuales de stock. Los ajustes escriben movimientos valorizados en el kardex según el
método de costeo de la empresa.

## Archivos clave

- `backend/src/modules/inventory/inventory.controller.ts` — rutas de movimientos, stock bajo y ajustes.
- `backend/src/modules/inventory/inventory.service.ts` — lógica de ajuste de stock, kardex y auditoría.
- `backend/src/modules/inventory/dto/inventory.dto.ts` — DTO de ajuste.
- `backend/src/modules/inventory/inventory.module.ts` — importa `PrismaModule`, `KardexModule`, `LowStockModule`.

## Autorización a nivel de controlador

- `@Controller('inventory')` → base real `/api/inventory`.
- Guards de clase: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`.
- `@RequireModule('inventory')` a nivel de clase.
- Guards globales: `CsrfGuard` (mutaciones), `ThrottlerGuard`.

## Endpoints

### GET /api/inventory/movements
- **Descripción**: Lista los últimos movimientos de inventario de la empresa (máx. 50, `createdAt` desc).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:view])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno.
- **Query/Body**: ninguno.
- **Respuesta**: array de `InventoryMovement` con `product` incluido.
- **Efectos secundarios**: solo lectura.

### GET /api/inventory/low-stock
- **Descripción**: Lista hasta 50 productos activos con `stockQuantity <= minStock` (filtrado en memoria).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:view])`.
- **Plan**: `@RequireModule('inventory')`.
- **Respuesta**: array de productos completos (`Product`) con stock bajo.
- **Efectos secundarios**: solo lectura.

### POST /api/inventory/adjustments
- **Descripción**: Aplica un ajuste de stock sobre un producto, crea un `InventoryMovement` y asienta en el kardex.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:adjust])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno (mutación → `Content-Type: application/json` por CsrfGuard).
- **Body (DTO `CreateInventoryAdjustmentDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `productId` | string | Sí | `@IsString()` | Producto a ajustar |
  | `type` | `InventoryMovementType` | Sí | `@IsEnum(InventoryMovementType)` | `IN`, `OUT`, `ADJUSTMENT`, `RETURN`, `LOSS`, `TRANSFER` |
  | `quantity` | number | Sí | `@IsNumber({maxDecimalPlaces:3})` | Cantidad del ajuste |
  | `presentationId` | string | No | `@IsString()` | Presentación asociada |
  | `unitCost` | number | No | `@IsNumber({maxDecimalPlaces:4})`, `@Min(0)` | Costo unitario (si no, se usa `product.costPrice`) |
  | `reason` | string | No (def. `Manual adjustment`) | `@IsString()` | Motivo |

- **Reglas de signo**: `IN` → delta `+quantity`; `OUT`/`LOSS` → delta `-quantity`; `ADJUSTMENT` (u otro) → delta `+quantity`. La cantidad no puede ser cero; para tipos distintos de `ADJUSTMENT` la cantidad debe ser positiva. El stock resultante no puede ser negativo.
- **Respuesta**: `{ updatedProduct, movement }` (producto actualizado y movimiento creado).
- **Efectos secundarios**: dentro de una transacción Prisma: actualiza `products.stockQuantity` (increment), crea `inventory_movements` y registra kardex (`recordInMovement` si delta>0; `recordOutMovement` con `delta.abs()` si delta<0). Fuera de la transacción: `AuditService.log` (`UPDATE`, entity `InventoryMovement`) y, si delta<0, `LowStockService.notifyIfLowStock`.
- **Errores**:
  - 404 `NotFoundException` si el producto no existe.
  - 400 `BadRequestException` si la cantidad es cero, negativa para tipos que requieren positivo, o si el stock quedaría negativo (`Stock insuficiente...`).

**Nota sobre `unitCost`**: solo se persiste `inventory_movements.unitCost` y `totalCost` cuando `type === 'IN'`; en los demás casos esos campos quedan `undefined`. En el kardex, el costo de entrada usa `input.unitCost ?? product.costPrice ?? 0`.

## Funciones del servicio (`InventoryService`)

### `findLowStock(companyId)`
- **Qué hace**: obtiene productos activos ordenados por stock y filtra `stockQuantity <= minStock` (máx. 50).
- **Escribe en**: nada.
- **Devuelve**: array de productos.
- **Lanza**: nada.

### `findMovements(companyId)`
- **Qué hace**: lista los últimos 50 movimientos con `product` incluido.
- **Escribe en**: nada.
- **Devuelve**: array de movimientos.
- **Lanza**: nada.

### `adjustStock(companyId, input)`
- **Qué hace**: valida el producto, signo/cantidad y stock disponible; en transacción actualiza stock, crea movimiento y asienta kardex; luego audita y notifica stock bajo si aplica.
- **Escribe en**: `products` (increment `stockQuantity`), `inventory_movements`, `inventory_kardex`; notificaciones `LOW_STOCK`; auditoría (`InventoryMovement`).
- **Devuelve**: `{ updatedProduct, movement }`.
- **Lanza**: 404 `NotFoundException` (producto); 400 `BadRequestException` (cantidad cero/negativa o stock negativo); las que lance el kardex (p. ej. estrategia de costeo desconocida).

## Dependencias y comportamiento cruzado

- `KardexService.getStrategy(companyId)` lee `Company.inventoryCostMethod` (`FIFO` o `WEIGHTED_AVERAGE`); si la empresa no existe lanza `NotFoundException` y si el método no tiene estrategia lanza `Error`.
- `LowStockService.notifyIfLowStock` crea notificaciones para `COMPANY_ADMIN`/`MANAGER` activos, evitando duplicados no leídos por producto (ver `low-stock.service.ts`).

## No verificado en el código

- No hay endpoint para listar kardex dentro de `inventory` (el kardex se expone en su propio módulo `kardex`; no inspeccionado aquí en cuanto a rutas).
- No se verificó tratamiento de `TRANSFER`/`RETURN` más allá de la regla de signo genérica (`ADJUSTMENT` y otros → delta positivo).
