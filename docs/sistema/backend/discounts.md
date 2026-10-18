# Módulo: discounts

## Propósito
Cupones de descuento por empresa: código canónico (mayúsculas), tipo (`PERCENTAGE`/`FIXED`), valor, cupo máximo de usos, vigencia y compra mínima. El descuento se valida y se consume **dentro de la transacción de la venta**, por lo que el cupo no puede sobre-venderse. Ver el listado y consultar un cupón está disponible para `COMPANY_ADMIN` y `MANAGER` (`discount:list`), aplicarlo en una venta para cualquier rol que pueda vender, y crear/editar/desactivar (`discount:manage`) es exclusivo de `COMPANY_ADMIN`.

## Archivos clave
- `backend/src/modules/discounts/discounts.controller.ts` — controller `discounts`; guards de clase `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard` + `@RequireModule('sales')` + `@RequireFeature('sales.discounts')`.
- `backend/src/modules/discounts/discounts.service.ts` — `DiscountsService`; crea, lista, edita, desactiva y valida cupones y exporta `resolveForSale(tx, ...)` (consumo transaccional usado por `SalesService`).
- `backend/src/modules/discounts/dto/discount.dto.ts` — `CreateDiscountCouponDto`, `UpdateDiscountCouponDto`, `QueryDiscountCouponDto`, `ValidateDiscountCouponDto`.
- `backend/src/modules/discounts/discounts.module.ts` — importa `PrismaModule`, exporta `DiscountsService`.
- Registrado en `backend/src/app.module.ts`; `SalesModule` importa `DiscountsModule`.

## Modelo
Tabla `discount_coupons` (modelo `DiscountCoupon`, migración `20261015000000_add_discount_coupons`):

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | `String` | cuid |
| `companyId` | `String` | `@@index([companyId, isActive])` |
| `code` | `String` | normalizado a mayúsculas; `@@unique([companyId, code])` |
| `description` | `String?` | |
| `type` | `DiscountType` | `PERCENTAGE` \| `FIXED`, default `PERCENTAGE` |
| `value` | `Decimal(12,2)` | % (máx 100) o monto fijo en soles |
| `maxUses` | `Int?` | `null` = ilimitado |
| `usedCount` | `Int` | default 0; se incrementa con `updateMany` condicionado |
| `minPurchase` | `Decimal(12,2)?` | `null` = sin compra mínima |
| `startsAt` / `expiresAt` | `DateTime?` | `null` = sin límite en ese extremo |
| `isActive` | `Boolean` | default `true`; el borrado lógico lo pone en `false` |
| `createdById` | `String?` | |
| `Sale.couponId` | `String?` | `@@index([couponId])`, relación `Sale.coupon` |

## Endpoints

Todos cuelgan del prefijo global `/api`. La autorización de los 5 endpoints es: rol + permiso (`PermissionsGuard`) y módulo/feature de plan (`PlanCapabilitiesGuard`).

### GET /api/discounts
- **Descripción**: lista paginada de cupones de la empresa.
- **Auth**: JWT + `TenantGuard` (`request.tenantId = user.companyId`).
- **Roles/permisos**: `COMPANY_ADMIN`, `MANAGER`; `discount:list`.
- **Plan**: módulo `sales` + feature `sales.discounts` (incluida en los 4 planes).
- **Query** (`QueryDiscountCouponDto`): `page` (default 1), `limit` (default 20, máx 100), `isActive` (`'true'`/`'false'`), `search` (insensible a mayúsculas en `code`/`description`).
- **Respuesta**: `{ items: DiscountCoupon[], total, page, limit, totalPages }`, orden `isActive desc, createdAt desc`.
- **Efectos secundarios**: ninguno.

### POST /api/discounts/validate
- **Descripción**: previsualiza el descuento de un cupón para un subtotal dado, sin consumirlo.
- **Roles/permisos**: `COMPANY_ADMIN`, `MANAGER`, `CASHIER`; `discount:list`.
- **Body** (`ValidateDiscountCouponDto`): `code` (requerido), `subtotal` (opcional, default 0).
- **Respuesta**: `{ coupon: { id, code, type, value, description }, discountAmount, totalAfterDiscount }`.
- **Efectos secundarios**: ninguno (el consumo ocurre al crear la venta).
- **Errores**: 400 si no existe/está inactivo, aún no está vigente, expiró, agotó cupos o no cumple la compra mínima.

### GET /api/discounts/:id
- **Descripción**: devuelve un cupón de la empresa.
- **Roles/permisos**: `COMPANY_ADMIN`, `MANAGER`; `discount:list`.
- **Respuesta**: `DiscountCoupon`.
- **Errores**: 404 `NotFoundException('Cupon de descuento no encontrado.')` si el `id` no pertenece a la empresa.

### POST /api/discounts
- **Descripción**: crea un cupón.
- **Roles/permisos**: **`COMPANY_ADMIN`**; `discount:manage`.
- **Body** (`CreateDiscountCouponDto`): `code` (requerido, `/^[A-Za-z0-9_-]{3,32}$/`), `value` (requerido, `>= 0.01`, máx 2 decimales), `type`, `description`, `maxUses` (`>= 1`), `minPurchase` (`>= 0`), `startsAt`/`expiresAt` (ISO 8601), `isActive`. Los campos admiten `null` explícito para "sin valor".
- **Respuesta**: `DiscountCoupon` creado.
- **Efectos secundarios**: auditoría `AuditAction.CREATE` sobre `DiscountCoupon`.
- **Errores**: 400 si el código ya existe en la empresa, si el valor es `<= 0`, si `PERCENTAGE > 100` o si `startsAt > expiresAt`; 403 sin rol/permiso/feature.

### PATCH /api/discounts/:id
- **Descripción**: edita un cupón. `undefined` = no tocar el campo; `null` = limpiarlo (p. ej. dejar de tener expiración o de tener cupo).
- **Roles/permisos**: **`COMPANY_ADMIN`**; `discount:manage`.
- **Body** (`UpdateDiscountCouponDto`): mismos campos, todos opcionales.
- **Efectos secundarios**: auditoría `AuditAction.UPDATE` (`before`/`after`).
- **Errores**: 404, 400 (código duplicado, valor inválido, ventana invertida).

### DELETE /api/discounts/:id
- **Descripción**: **desactivación lógica** (`isActive = false`); no borra el registro ni su historial de usos.
- **Roles/permisos**: **`COMPANY_ADMIN`**; `discount:manage`.
- **Respuesta**: `DiscountCoupon` con `isActive = false`.
- **Efectos secundarios**: auditoría `AuditAction.DELETE` (`deactivated: true`).

## Servicio

- `create(companyId, userId, input)` — normaliza `code` a mayúsculas, valida ventana y valor, rechaza duplicado, persiste y audita.
- `findAll(companyId, query)` — filtros + paginación (ver arriba).
- `findOne(companyId, id)` — 404 si no pertenece a la empresa.
- `update(companyId, id, input)` — mezcla `undefined` (mantener) / `null` (limpiar) y revalida ventana, valor y duplicidad de código.
- `remove(companyId, id)` — desactiva lógicamente.
- `validate(companyId, code, subtotal?)` — previsualización; delega en `evaluate`.
- `resolveForSale(tx, companyId, code, subtotal)` — **uso autoritativo dentro de la transacción de la venta**:
  1. `evaluate` (existencia, activo, vigencia, cupos, compra mínima) con `tx`.
  2. `updateMany({ id, companyId, isActive: true, ...(maxUses ? { usedCount: { lt: maxUses } } : {}) }, { usedCount: { increment: 1 } })`.
  3. Si `count !== 1` → 400 `El cupon de descuento ya no tiene cupos disponibles.` (evita condiciones de carrera).
  - Devuelve `{ couponId, code, type, value, discountAmount }`.
- `evaluate` (privado) — `discountAmount = PERCENTAGE ? subtotal × value / 100 : value`, acotado al subtotal y redondeado a 2 decimales (`Prisma.Decimal`).
- `assertValue` / `assertWindow` (privados) — validaciones de valor y de orden de fechas.

## Errores (400 `BadRequestException`)

- `Ya existe un cupon con el codigo <CODE>.`
- `El valor del descuento debe ser mayor a 0.`
- `El porcentaje de descuento no puede ser mayor a 100.`
- `La fecha de inicio no puede ser posterior a la de expiracion.`
- `El cupon no existe o no esta activo.`
- `El cupon aun no esta vigente.`
- `El cupon ha expirado.`
- `El cupon ha alcanzado su limite de usos.`
- `El cupon requiere una compra minima de <n>.`
- `El cupon de descuento ya no tiene cupos disponibles.`

## Relación con `sales`

- `CreateSaleDto.couponCode` aplica un cupón. `SalesService` **rechaza combinar** `couponCode` con un `discountAmount > 0` manual (400).
- El descuento se recalcula con el subtotal real de la transacción (el precio del cliente es una previsualización).
- `SalesService.assertDiscountsEnabled()` solo se invoca cuando la venta trae descuento (cupón o manual) y lanza 403 `FEATURE_NOT_AVAILABLE` si el plan no tiene `sales.discounts`; así las ventas normales no se bloquean.
- En cancelación/reversión **no se devuelve el uso del cupón** (`usedCount` no se decrementa).

## Notas de seguridad / operación

- Ningún endpoint de este módulo es público: los 5 exigen JWT.
- El gating de plan se aplica por módulo (`sales`) y feature (`sales.discounts`), no por permiso de empresa.
- `DELETE` no borra datos: preserva el histórico de `usedCount` y `Sale.couponId`.
