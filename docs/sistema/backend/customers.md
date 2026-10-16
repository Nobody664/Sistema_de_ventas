# Módulo: Customers

## Propósito
Gestiona el padrón de clientes de cada empresa (tenant): alta, edición, borrado (físico o lógico),
consulta de compras históricas y exposición de los límites del plan para el recurso `customers`.

## Archivos clave
- `backend/src/modules/customers/customers.controller.ts` — rutas HTTP, guards, roles, permisos y gating por módulo/plan.
- `backend/src/modules/customers/customers.service.ts` — lógica de negocio, límites, auditoría y borrado.
- `backend/src/modules/customers/dto/customer.dto.ts` — `CreateCustomerDto` y `UpdateCustomerDto`.
- `backend/src/modules/customers/customers.module.ts` — registra controlador, servicio y `SubscriptionLimitService`.

## Endpoints

Guards a nivel de controlador: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)` y
`@RequireModule('customers')`. El `tenantId` proviene del JWT/guard (`request.tenantId`), nunca del body.

### GET /api/customers/limits
- **Descripción**: Devuelve la información de límites del plan para la empresa.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([customer:list])`.
- **Plan**: `@RequireModule('customers')` (a nivel de controlador).
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: resultado de `SubscriptionLimitService.getAllLimitsInfo(companyId)`.
- **Efectos secundarios**: ninguno (solo lectura).
- **Errores**: 401/403 por guards; 403 `MODULE_NOT_ENABLED` si el plan no incluye `customers`.

### GET /api/customers/:id
- **Descripción**: Obtiene un cliente por id dentro de la empresa.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER', 'CASHIER'])`, `@Permissions([customer:list])`.
- **Plan**: `@RequireModule('customers')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del cliente (`cuid`). |

- **Respuesta**: el objeto `Customer` o `null` (usa `findFirst` con `{ id, companyId }`; no lanza 404 si no existe).
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards.

### GET /api/customers/:id/purchases
- **Descripción**: Lista las ventas del cliente e incluye estadísticas de compra.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER', 'CASHIER'])`, `@Permissions([customer:list])`.
- **Plan**: `@RequireModule('customers')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del cliente. |

- **Respuesta**: `{ purchases: Sale[], stats: { totalSpent, purchaseCount, lastPurchaseDate, averageTicket } }`.
  Cada venta incluye `employee` (nombre) e `items` con `product.name`.
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards. No valida existencia del cliente (si no existe, devuelve lista vacía y stats en cero).

### GET /api/customers
- **Descripción**: Lista clientes de la empresa (máximo 50, más recientes primero).
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER', 'CASHIER'])`, `@Permissions([customer:list])`.
- **Plan**: `@RequireModule('customers')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de clientes con campos `id, firstName, lastName, email, phone, documentType, documentValue, createdAt`.
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards.

### POST /api/customers
- **Descripción**: Crea un cliente.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER', 'CASHIER'])`, `@Permissions([customer:create])`.
- **Plan**: `@RequireModule('customers')`; límite de recurso con `@LimitResource('customers')`.
- **Guards extra**: `SubscriptionLimitGuard`.
- **Body (DTO `CreateCustomerDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `firstName` | string | sí | `@IsString()` | Nombres. |
| `lastName` | string | no | `@IsString()` | Apellidos. |
| `email` | string | no | `@IsEmail()` | Correo. |
| `phone` | string | no | `@IsString()` | Teléfono. |
| `documentType` | string | no | `@IsString()` | Tipo de documento. |
| `documentValue` | string | no | `@IsString()` | Número de documento. |
| `address` | string | no | `@IsString()` | Dirección. |
| `notes` | string | no | `@IsString()` | Notas. |

- **Respuesta**: el `Customer` creado.
- **Efectos secundarios**: escribe en `customers`; registra auditoría (`action: CREATE`, `entity: 'Customer'`).
- **Errores**: 403 `LIMIT_EXCEEDED` si supera el límite; 409 por unicidad (`(companyId, email)` / `(companyId, documentValue)` → `P2002`); 400 por validación; 403 CSRF/validación de módulo.

### PATCH /api/customers/:id
- **Descripción**: Actualiza un cliente.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([customer:update])`.
- **Plan**: `@RequireModule('customers')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del cliente. |
| Body | `UpdateCustomerDto` (`extends CreateCustomerDto`) | sí | mismas reglas que `CreateCustomerDto` | Campos a actualizar (todos opcionales salvo que `firstName` se conserve como requerido en el DTO base). |

- **Respuesta**: el `Customer` actualizado.
- **Efectos secundarios**: escribe en `customers`; auditoría (`action: UPDATE`, `changes.before/after`).
- **Errores**: 404 `Customer not found.` si no existe en la empresa; 409 unicidad; 400 validación.

### DELETE /api/customers/:id
- **Descripción**: Elimina un cliente. Si tiene ventas asociadas hace borrado lógico (`deletedAt`); si no, borrado físico.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN'])`, `@Permissions([customer:delete])`.
- **Plan**: `@RequireModule('customers')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del cliente. |

- **Respuesta**: el `Customer` (actualizado con `deletedAt` o eliminado).
- **Efectos secundarios**: escribe en `customers`; auditoría (`action: DELETE`, con `changes.softDelete` y conteo de ventas).
- **Errores**: 404 `Customer not found.` si no existe en la empresa.

## Funciones del servicio (`CustomersService`)

### `getLimitsInfo(companyId)`
- **Qué hace**: delega en `limitService.getAllLimitsInfo(companyId)`.
- **Escribe en**: nada.
- **Devuelve**: información de límites del plan.
- **Lanza**: lo que propague `SubscriptionLimitService`.

### `findById(companyId, id)`
- **Qué hace**: busca un cliente por `id` + `companyId`.
- **Escribe en**: nada.
- **Devuelve**: `Customer | null`.
- **Lanza**: nada (sin `NotFoundException`).

### `getPurchases(companyId, customerId)`
- **Qué hace**: obtiene ventas del cliente con `employee` e `items.product`, y calcula estadísticas.
- **Escribe en**: nada.
- **Devuelve**: `{ purchases, stats: { totalSpent, purchaseCount, lastPurchaseDate, averageTicket } }`.
- **Lanza**: nada.

### `findByCompany(companyId)`
- **Qué hace**: lista hasta 50 clientes ordenados por `createdAt` descendente con selección reducida de campos.
- **Escribe en**: nada.
- **Devuelve**: array de clientes.
- **Lanza**: nada.

### `create(companyId, input)`
- **Qué hace**: valida límite de `customers` y crea el registro.
- **Escribe en**: `customers`; auditoría.
- **Devuelve**: `Customer` creado.
- **Lanza**: `LIMIT_EXCEEDED` (403) si excede el plan; errores Prisma (p. ej. `P2002`).

### `update(companyId, id, input)`
- **Qué hace**: verifica existencia (`ensureCustomer`) y actualiza.
- **Escribe en**: `customers`; auditoría.
- **Devuelve**: `Customer` actualizado.
- **Lanza**: `NotFoundException('Customer not found.')`; errores Prisma.

### `remove(companyId, id)`
- **Qué hace**: verifica existencia; cuenta ventas del cliente; si hay ventas, borrado lógico (`deletedAt`); si no, borrado físico.
- **Escribe en**: `customers`; auditoría.
- **Devuelve**: `Customer` afectado.
- **Lanza**: `NotFoundException('Customer not found.')`.

### `ensureCustomer(companyId, id)` (privado)
- **Qué hace**: busca el cliente por `id` + `companyId`.
- **Escribe en**: nada.
- **Devuelve**: `Customer`.
- **Lanza**: `NotFoundException('Customer not found.')`.

## Observaciones
- No verificado en el código si el borrado lógico (`deletedAt`) excluye de facto al cliente de otros
  listados: `findByCompany` y `findById` no filtran por `deletedAt`.
- No se detectó paginación por `page`/`limit` en el listado; usa `take: 50` fijo.
