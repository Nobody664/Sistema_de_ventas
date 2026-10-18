# Módulo: stock-entries

## Propósito

Gestiona los ingresos de mercadería (cabeceras con líneas de producto). Al crear un ingreso se
incrementa el stock, se recalcula el costo del producto y se asienta una entrada en el kardex por
cada línea.

## Archivos clave

- `backend/src/modules/stock-entries/stock-entries.controller.ts` — rutas de listado/consulta/creación.
- `backend/src/modules/stock-entries/stock-entries.service.ts` — lógica de ingreso, conversión de presentaciones, kardex y auditoría.
- `backend/src/modules/stock-entries/dto/stock-entry.dto.ts` — DTO de ingreso y de líneas.
- `backend/src/modules/stock-entries/stock-entries.module.ts` — importa `PrismaModule`, `KardexModule`.

## Autorización a nivel de controlador

- `@Controller('stock-entries')` → base real `/api/stock-entries`.
- Guards de clase: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`.
- `@RequireModule('inventory')` a nivel de clase (el módulo de plan es `inventory`, no uno propio).
- Guards globales: `CsrfGuard` (mutaciones), `ThrottlerGuard`.

## Endpoints

### GET /api/stock-entries
- **Descripción**: Lista los últimos 100 ingresos de la empresa (`createdAt` desc).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:view])`.
- **Plan**: `@RequireModule('inventory')`.
- **Query/Body**: ninguno.
- **Respuesta**: array de `StockEntry` con `branch {id,name}` e `items` que incluyen `product {id,name,sku,baseUnit}` y `presentation {id,name,factor}`.
- **Efectos secundarios**: solo lectura.

### GET /api/stock-entries/:id
- **Descripción**: Obtiene un ingreso por id con sucursal, líneas, producto y presentación.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:view])`.
- **Plan**: `@RequireModule('inventory')`.
- **Path params**: `id`.
- **Respuesta**: `StockEntry` con relaciones.
- **Efectos secundarios**: solo lectura.
- **Errores**: 404 `NotFoundException` si no existe en la empresa.

### POST /api/stock-entries
- **Descripción**: Registra un ingreso de mercadería con una o más líneas; incrementa stock, actualiza costo y asienta kardex.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:inbound])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno (mutación → `Content-Type: application/json` por CsrfGuard).
- **Body (DTO `CreateStockEntryDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `branchId` | string | No | `@IsString()` | Sucursal (se valida que exista en la empresa) |
  | `reference` | string | No | `@IsString()` | Referencia/documento |
  | `notes` | string | No | `@IsString()` | Notas |
  | `items` | `StockEntryItemDto[]` | Sí | `@ArrayMinSize(1)`, `@ValidateNested` | Líneas del ingreso |

- **Body de cada línea (DTO `StockEntryItemDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `productId` | string | Sí | `@IsString()` | Producto |
  | `presentationId` | string | No | `@IsString()` | Presentación del producto |
  | `quantity` | number | Sí | `@IsNumber({maxDecimalPlaces:3})`, `@Min(0.001)` | Cantidad en la presentación/unidad |
  | `unitCost` | number | Sí | `@IsNumber({maxDecimalPlaces:4})`, `@Min(0)` | Costo unitario de compra |

- **Cálculos por línea**:
  - `factor` = `presentation.factor` (si hay presentación) o `1`.
  - `baseQuantity` = `quantity × factor`.
  - `totalCost` = `unitCost × quantity`.
  - `baseUnitCost` = `baseQuantity == 0 ? unitCost : totalCost / baseQuantity`.
- **Respuesta**: el ingreso re-consultado (`findById`) con relaciones.
- **Efectos secundarios** (en transacción Prisma): crea `stock_entries` + `stock_entry_items`; por cada línea hace `products.stockQuantity += baseQuantity` y setea `products.costPrice = baseUnitCost`; crea `inventory_movements` (`type: 'IN'`, `quantity: baseQuantity`, `unitCost: baseUnitCost`, `totalCost`, `notes: 'Stock entry <id>'`); asienta `inventory_kardex` (`recordInMovement`). Dentro de la misma transacción: `AuditService.log` (`CREATE`, entity `StockEntry`, con detalle de ítems).
- **Errores**:
  - 404 `NotFoundException` si `branchId` o algún `productId` no existen.
  - 400 `BadRequestException` si un `presentationId` no pertenece al producto (la presentación se busca entre las del producto).
  - Las que lance el kardex (empresa inexistente/estrategia desconocida).

## Funciones del servicio (`StockEntriesService`)

### `findAll(companyId)`
- **Qué hace**: lista los últimos 100 ingresos con relaciones.
- **Escribe en**: nada.
- **Devuelve**: array de `StockEntry`.
- **Lanza**: nada.

### `findById(companyId, id)`
- **Qué hace**: busca el ingreso con relaciones y valida existencia.
- **Escribe en**: nada.
- **Devuelve**: `StockEntry` con `branch` e `items`.
- **Lanza**: 404 `NotFoundException`.

### `create(companyId, input)`
- **Qué hace**: valida sucursal, carga productos/presentaciones, calcula cantidades/costos base y en transacción crea cabecera+ítems, actualiza stock/costo, crea movimientos y kardex, y audita.
- **Escribe en**: `stock_entries`, `stock_entry_items`, `products` (`stockQuantity`, `costPrice`), `inventory_movements`, `inventory_kardex`; auditoría (`StockEntry`).
- **Devuelve**: el ingreso creado (vía `findById`).
- **Lanza**: 404 (sucursal/producto); 400 (presentación inválida); errores del kardex.

## No verificado en el código

- No hay endpoints de actualización ni eliminación de ingresos en este módulo.
- El efecto sobre costos usa `baseUnitCost` como nuevo `costPrice` del producto (sobrescritura directa), pero no se verificó interacción con `inventoryCostMethod` más allá del asiento en kardex.

## Actualizacion: fecha de ingreso y vencimiento por item

- `CreateStockEntryDto.entryDate?: string` (default `now()`) y `StockEntryItemDto.expiryDate?: string | null`.
- El servicio persiste `entryDate` en la entrada, el `expiryDate` de cada item, actualiza `Product.expiryDate` para los productos con vencimiento informado, y fuera de la transaccion recorre los items llamando `LowStockService.notifyIfExpiring` (best-effort, try/catch).
- `GET /api/stock-entries` devuelve `entryDate` y el `expiryDate` de cada item (usa `include`, por lo que expone todos los campos escalares).
