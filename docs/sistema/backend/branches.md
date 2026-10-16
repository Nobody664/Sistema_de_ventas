# Módulo: branches

## Propósito

Gestiona las sucursales (`Branch`) de una empresa: listar, consultar, crear, actualizar y
desactivar. Las sucursales se usan en inventario (lotes, movimientos, kardex) y requieren el módulo de
plan `inventory`.

## Archivos clave

- `backend/src/modules/branches/branches.controller.ts` — rutas CRUD de sucursales.
- `backend/src/modules/branches/branches.service.ts` — lógica de sucursales (soft-delete por `isActive`).
- `backend/src/modules/branches/dto/branch.dto.ts` — DTOs `CreateBranchDto` y `UpdateBranchDto`.
- `backend/src/modules/branches/branches.module.ts` — importa `PrismaModule`; exporta `BranchesService`.

## Autorización a nivel de controlador

- `@Controller('branches')` → base real `/api/branches`.
- Guards de clase: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`.
- `@RequireModule('inventory')` a nivel de clase.
- Guards globales (registrados en `AppModule`): `CsrfGuard` (mutaciones), `ThrottlerGuard`,
  `JwtAuthGuard`, `RolesGuard`, `PlanCapabilitiesGuard`.

## Endpoints

### GET /api/branches
- **Descripción**: Lista las sucursales de la empresa ordenadas por nombre asc.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:view])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de `Branch`.
- **Efectos secundarios**: solo lectura.
- **Errores**: ninguno explícito.

### GET /api/branches/:id
- **Descripción**: Obtiene una sucursal por id, incluyendo sus últimos 5 lotes.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([inventory:view])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno.
- **Path params**: `id`.
- **Respuesta**: `Branch` con `productBatches` (máx. 5, orden `createdAt` desc).
- **Efectos secundarios**: solo lectura.
- **Errores**: 404 `NotFoundException('Branch not found')` si no existe en la empresa.

### POST /api/branches
- **Descripción**: Crea una sucursal.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN'])` + `@Permissions([branch:manage])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno (mutación → `Content-Type: application/json` por CsrfGuard).
- **Body (DTO `CreateBranchDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `name` | string | Sí | `@IsString()` | Nombre de la sucursal |
  | `address` | string | No | `@IsString()` | Dirección |

- **Respuesta**: `Branch` creado.
- **Efectos secundarios**: escribe `branches`. No audita ni crea movimientos/kardex.
- **Errores**: ninguno explícito (errores Prisma se normalizan por el filtro global).

### PATCH /api/branches/:id
- **Descripción**: Actualiza `name`, `address` y/o `isActive` de una sucursal.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN'])` + `@Permissions([branch:manage])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno.
- **Path params**: `id`.
- **Body (DTO `UpdateBranchDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `name` | string | No | `@IsString()` | Nuevo nombre |
  | `address` | string | No | `@IsString()` | Nueva dirección |
  | `isActive` | boolean | No | `@IsBoolean()` | Activa/desactiva la sucursal |

- **Respuesta**: `Branch` actualizado.
- **Efectos secundarios**: escribe `branches` (solo campos enviados). No audita.
- **Errores**: 404 `NotFoundException('Branch not found')` si no existe en la empresa.

### DELETE /api/branches/:id
- **Descripción**: Desactiva una sucursal (no borra físicamente): pone `isActive = false`.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN'])` + `@Permissions([branch:manage])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno.
- **Path params**: `id`.
- **Respuesta**: `{ deactivated: true }`.
- **Efectos secundarios**: escribe `branches` (`isActive = false`). No audita.
- **Errores**: 404 `NotFoundException('Branch not found')` si no existe en la empresa.

## Funciones del servicio (`BranchesService`)

### `create(companyId, dto)`
- **Qué hace**: crea la sucursal con `name` y `address` de la empresa.
- **Escribe en**: `branches`.
- **Devuelve**: `Branch`.
- **Lanza**: nada explícito.

### `findAll(companyId)`
- **Qué hace**: lista las sucursales de la empresa ordenadas por `name` asc.
- **Escribe en**: nada.
- **Devuelve**: array de `Branch`.
- **Lanza**: nada.

### `findById(companyId, id)`
- **Qué hace**: busca la sucursal por `(id, companyId)` e incluye los últimos 5 lotes.
- **Escribe en**: nada.
- **Devuelve**: `Branch` con `productBatches`.
- **Lanza**: 404 `NotFoundException('Branch not found')`.

### `update(companyId, id, dto)`
- **Qué hace**: valida existencia y actualiza solo los campos enviados (`name`, `address`, `isActive`).
- **Escribe en**: `branches`.
- **Devuelve**: `Branch` actualizado.
- **Lanza**: 404 `NotFoundException('Branch not found')`.

### `remove(companyId, id)`
- **Qué hace**: valida existencia y marca `isActive = false` (desactivación lógica).
- **Escribe en**: `branches`.
- **Devuelve**: `{ deactivated: true }`.
- **Lanza**: 404 `NotFoundException('Branch not found')`.

## No verificado en el código

- Según la matriz de `ROLE_PERMISSIONS` en `roles-permisos-planes.md`, el permiso `branch:manage` no
  está asignado a `COMPANY_ADMIN` ni a `MANAGER`; por lo tanto las mutaciones (POST/PATCH/DELETE)
  quedarían efectivamente accesibles solo para `SUPER_ADMIN` (que omite permisos). No se verificó en el
  seed ni en migraciones una asignación distinta.
- `remove` no valida si la sucursal tiene lotes o movimientos asociados; solo cambia `isActive`.
- El servicio no inyecta `AuditService`, por lo que estas operaciones no generan auditoría.
