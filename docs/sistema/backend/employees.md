# Módulo: Employees

## Propósito
Gestiona los empleados de cada empresa y su vínculo opcional con un `User` (crea usuario + membership
al dar de alta). Expone además los límites del plan para el recurso `employees`.

## Archivos clave
- `backend/src/modules/employees/employees.controller.ts` — rutas HTTP, guards, roles, permisos y gating por módulo/plan.
- `backend/src/modules/employees/employees.service.ts` — lógica de negocio, creación transaccional usuario/membership/empleado y borrado.
- `backend/src/modules/employees/dto/employee.dto.ts` — `CreateEmployeeDto` y `UpdateEmployeeDto`.
- `backend/src/modules/employees/employees.module.ts` — registra controlador, servicio y `SubscriptionLimitService`.

## Endpoints

Guards a nivel de controlador: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)` y
`@RequireModule('employees')`. El `tenantId` proviene del guard (`request.tenantId`).

### GET /api/employees/limits
- **Descripción**: Devuelve la información de límites del plan para la empresa.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([employee:list])`.
- **Plan**: `@RequireModule('employees')` (nivel de controlador).
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: resultado de `SubscriptionLimitService.getAllLimitsInfo(companyId)`.
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards; 403 `MODULE_NOT_ENABLED` si el plan no incluye `employees`.

### GET /api/employees/:id
- **Descripción**: Obtiene un empleado por id dentro de la empresa, incluyendo datos del `user` vinculado.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([employee:list])`.
- **Plan**: `@RequireModule('employees')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del empleado. |

- **Respuesta**: `Employee` con `user: { id, email, fullName, isActive }`, o `null` (no lanza 404).
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards.

### GET /api/employees
- **Descripción**: Lista empleados de la empresa (máximo 50, más recientes primero).
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER'])`, `@Permissions([employee:list])`.
- **Plan**: `@RequireModule('employees')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array con campos `id, firstName, lastName, email, phone, dni, role, isActive, createdAt, user.email`.
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards.

### POST /api/employees
- **Descripción**: Crea un empleado, y en una transacción crea también su `User` y `Membership`.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN'])`, `@Permissions([employee:create])`.
- **Plan**: `@RequireModule('employees')`; límite de recurso con `@LimitResource('employees')`.
- **Guards extra**: `SubscriptionLimitGuard`.
- **Body (DTO `CreateEmployeeDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `userId` | string | no | `@IsString()` | Vínculo opcional a `User` (en la implementación no se usa para enlazar; se crea un usuario nuevo a partir de `email`). |
| `firstName` | string | sí | `@IsString()` | Nombres. |
| `lastName` | string | no | `@IsString()` | Apellidos. |
| `email` | string | sí | `@IsEmail()` | Correo del nuevo usuario. |
| `phone` | string | no | `@IsString()` | Teléfono. |
| `dni` | string | no | `@IsString()`, `@MinLength(8)` (mensaje: "El DNI debe tener 8 dígitos") | DNI. |
| `password` | string | sí | `@IsString()`, `@MinLength(8)` | Contraseña (se hashea con argon2). |
| `role` | string | sí | `@IsIn(['COMPANY_ADMIN','MANAGER','CASHIER','VIEWER'])` | Rol de la membership. |
| `isActive` | boolean | no | `@IsBoolean()` | Estado (defecto `true`). |

- **Respuesta**: el `Employee` creado con `user: { id, email, fullName }`.
- **Efectos secundarios**: escribe en `users`, `memberships` y `employees` (transacción); auditoría (`action: CREATE`, `entity: 'Employee'`).
- **Errores**: 409 `Ya existe un usuario con ese correo electrónico.`; 403 `LIMIT_EXCEEDED`; 400 validación.

### PATCH /api/employees/:id
- **Descripción**: Actualiza un empleado existente.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN'])`, `@Permissions([employee:update])`.
- **Plan**: `@RequireModule('employees')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del empleado. |
| `firstName` | string | no | `@IsString()` | Nombres. |
| `lastName` | string | no | `@IsString()` | Apellidos. |
| `email` | string | no | `@IsEmail()` | Correo. |
| `phone` | string | no | `@IsString()` | Teléfono. |
| `dni` | string | no | `@IsString()`, `@MinLength(8)` | DNI. |
| `role` | string | no | `@IsIn(['COMPANY_ADMIN','MANAGER','CASHIER','VIEWER'])` | Rol. |
| `isActive` | boolean | no | `@IsBoolean()` | Estado. |

- **Respuesta**: el `Employee` actualizado.
- **Efectos secundarios**: escribe en `employees`; auditoría (`action: UPDATE`, `changes.before/after`). No actualiza `User`/`Membership`.
- **Errores**: 404 `Employee not found.`; 400 validación.

### DELETE /api/employees/:id
- **Descripción**: Elimina un empleado. Si tiene ventas asociadas, hace borrado lógico y desactiva su membership; si no, borra membership y empleado físicamente.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN'])`, `@Permissions([employee:delete])`.
- **Plan**: `@RequireModule('employees')`.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id del empleado. |

- **Respuesta**: el `Employee` afectado (o eliminado).
- **Efectos secundarios**: escribe en `employees` y `memberships` (transacción); auditoría (`action: DELETE`). No elimina el `User` en ningún caso.
- **Errores**: 404 `Employee not found.`.

## Funciones del servicio (`EmployeesService`)

### `getLimitsInfo(companyId)`
- **Qué hace**: delega en `limitService.getAllLimitsInfo(companyId)`.
- **Escribe en**: nada.
- **Devuelve**: información de límites del plan.
- **Lanza**: lo que propague `SubscriptionLimitService`.

### `findById(companyId, id)`
- **Qué hace**: busca empleado por `id` + `companyId` con datos del `user`.
- **Escribe en**: nada.
- **Devuelve**: `Employee | null`.
- **Lanza**: nada.

### `findByCompany(companyId)`
- **Qué hace**: lista hasta 50 empleados con `user.email`.
- **Escribe en**: nada.
- **Devuelve**: array de empleados.
- **Lanza**: nada.

### `create(companyId, input)`
- **Qué hace**: valida límite; verifica que no exista `User` con ese email; hashea el password (argon2); en transacción crea `User` (`globalRole: 'USER'`), `Membership` (`role` del input) y `Employee`.
- **Escribe en**: `users`, `memberships`, `employees`; auditoría.
- **Devuelve**: `Employee` creado (con `user`).
- **Lanza**: `ConflictException` si el email ya existe; `LIMIT_EXCEEDED`; errores Prisma.

### `update(companyId, id, input)`
- **Qué hace**: verifica existencia (`ensureEmployee`) y actualiza solo `Employee`.
- **Escribe en**: `employees`; auditoría.
- **Devuelve**: `Employee` actualizado.
- **Lanza**: `NotFoundException('Employee not found.')`; errores Prisma.

### `remove(companyId, id)`
- **Qué hace**: verifica existencia; cuenta ventas (`employeeId`). Si hay ventas: borrado lógico (`isActive: false`, `deletedAt`) y `membership.updateMany` a `isActive: false`. Si no: `membership.deleteMany` y `employee.delete`.
- **Escribe en**: `employees`, `memberships` (transacción); auditoría.
- **Devuelve**: `Employee` afectado.
- **Lanza**: `NotFoundException('Employee not found.')`.

### `ensureEmployee(companyId, id)` (privado)
- **Qué hace**: busca el empleado por `id` + `companyId`.
- **Escribe en**: nada.
- **Devuelve**: `Employee`.
- **Lanza**: `NotFoundException('Employee not found.')`.

## Observaciones
- El DTO acepta `userId` opcional, pero `create` no lo usa para vincular un usuario existente: siempre crea un `User` nuevo a partir de `email`.
- `findByCompany` no filtra por `deletedAt`, por lo que los empleados con borrado lógico podrían seguir apareciendo (no verificado en otros listados).
