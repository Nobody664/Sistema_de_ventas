# Módulo: Companies

## Propósito
Gestiona las empresas (tenants) del sistema: lectura y actualización de la empresa actual
del usuario autenticado, y administración global (listado, alta, aprobación/rechazo y
cambio de estado) reservada a roles de plataforma. Sincroniza el flag `profileComplete`
y `profileCompletedAt` de la empresa a partir de sus datos de perfil.

## Archivos clave
- `backend/src/modules/companies/companies.controller.ts` — endpoints de empresa actual y administración global.
- `backend/src/modules/companies/companies.service.ts` — lógica de negocio y acceso a `companies`/`subscriptions`/`plans`.
- `backend/src/modules/companies/dto/company.dto.ts` — `CreateCompanyDto`, `CreateCompanyWithPlanDto`, `UpdateCompanyDto`, `UpdateCompanyStatusDto`.
- `backend/src/modules/companies/companies.module.ts` — registra controller y service, importa `PrismaModule`, exporta `CompaniesService`.
- `backend/src/common/helpers/profile-completeness.helper.ts` — `isProfileComplete` / `evaluateProfile` usados por `profileSync`.

## Endpoints

Notas de guards:
- Globales (registrados en `app.module.ts`): `CsrfGuard`, `ThrottlerGuard` (60 req/min por defecto), `JwtAuthGuard`, `RolesGuard`, `PlanCapabilitiesGuard`.
- `CompaniesController` usa `@Controller('companies')` sin `@UseGuards` a nivel de clase; **cada endpoint repite** `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)` y agrega `TenantGuard` en los endpoints de empresa actual (`current`).
- El `SUPER_ADMIN` siempre pasa `RolesGuard` y `PermissionsGuard` (bypass implementado en ambos guards); `SUPPORT_ADMIN` no recibe bypass de `RolesGuard`, por eso se lo lista explícitamente donde corresponde.
- Ningún endpoint usa `@RequireModule`, `@RequireFeature`, `@RequirePlan` ni `@LimitResource`.
- Throttling: sin overrides por endpoint (límite global 60/min).

### GET /api/companies/current
- **Descripción**: Devuelve la empresa (tenant) del usuario autenticado con su suscripción/plan.
- **Auth**: JWT + `@Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')` + `@Permissions(Permission.COMPANY_VIEW)` (`company:view`).
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, PermissionsGuard)`. `TenantGuard` exige `companyId` en el token (setea `request.tenantId`) y bloquea `SUSPENDED`/`INACTIVE`/`PAST_DUE`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: ninguno.
- **Respuesta**: objeto `Company` con `subscriptions` (incluye `plan`, `take: 1`).
- **Efectos secundarios**: ninguno (solo lectura).
- **Errores**: `403` si falta contexto de tenant o la empresa está bloqueada (mensajes específicos del `TenantGuard`); `403` si el rol/permiso no alcanza (`No tienes permisos para acceder a este recurso.` / `No tienes permisos para realizar esta accion.`); `404` si la empresa no existe (`Company not found.`).

### PATCH /api/companies/current
- **Descripción**: Actualiza los datos de la empresa del usuario autenticado.
- **Auth**: JWT + `@Roles('COMPANY_ADMIN')` + `@Permissions(Permission.COMPANY_UPDATE)` (`company:update`).
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, PermissionsGuard)`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body (DTO `UpdateCompanyDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `name` | string | No | `@IsOptional`, `@IsString`, `@MaxLength(120)` | Nombre de la empresa. |
| `legalName` | string | No | `@IsOptional`, `@IsString`, `@MaxLength(200)` | Razón social. |
| `taxId` | string | No | `@IsOptional`, `@IsString`, `@MaxLength(20)` | RUC/identificación fiscal. |
| `address` | string | No | `@IsOptional`, `@IsString`, `@MaxLength(255)` | Dirección. |
| `email` | string | No | `@IsOptional`, `@IsEmail` | Correo de la empresa. |
| `phone` | string | No | `@IsOptional`, `@IsString` | Teléfono. |
| `timezone` | string | No | `@IsOptional`, `@IsString` | Zona horaria. |
| `currency` | string | No | `@IsOptional`, `@IsString` | Moneda. |

- **Respuesta**: el registro `Company` actualizado.
- **Efectos secundarios**: actualiza `companies`; recalcula `profileComplete` y, si queda completo, `profileCompletedAt`.
- **Errores**: `404` si la empresa no existe; `403` de tenant/rol/permiso; `403` CSRF; `400` validación.

### GET /api/companies
- **Descripción**: Lista todas las empresas (paginado).
- **Auth**: JWT + `@Roles('SUPER_ADMIN')` + `@Permissions(Permission.COMPANY_MANAGE_ALL)` (`company:manage_all`).
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`.
- **Path params**: ninguno.
- **Query**:
  - `page` (opcional) — página; por defecto `1` en el servicio. Llega como string sin `ParseIntPipe`, por lo que no se valida/transforma en el controller.
  - `limit` (opcional) — tamaño de página; por defecto `20` en el servicio. Misma observación.
- **Body**: ninguno.
- **Respuesta**: `{ data: Company[], total, page, limit, totalPages }`. Cada empresa incluye `subscriptions` (con `plan`, `take: 1`) y `_count` de `memberships` y `customers`. Nota: la clave es `data`, no `items`.
- **Efectos secundarios**: ninguno.
- **Errores**: `403` de rol/permiso.

### GET /api/companies/:id
- **Descripción**: Devuelve una empresa por id.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')` + `@Permissions(Permission.COMPANY_MANAGE_ALL)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`.
- **Path params**: `id` (string).
- **Query**: ninguno.
- **Body**: ninguno.
- **Respuesta**: `Company` con `subscriptions` (incluye `plan`, `take: 1`).
- **Efectos secundarios**: ninguno.
- **Errores**: `404` (`Company not found.`); `403` de rol/permiso.

### POST /api/companies
- **Descripción**: Crea una empresa `TRIAL` y, si existe el plan `FREE`, su suscripción `TRIALING`.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')` + `@Permissions(Permission.COMPANY_MANAGE_ALL)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body (DTO `CreateCompanyDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `name` | string | Sí | `@IsString`, `@MaxLength(120)` | Nombre (obligatorio). |
| `slug` | string | No | `@IsOptional`, `@IsString` | Si falta, se genera desde `name` + `Date.now()`. |
| `legalName` | string | No | `@IsOptional`, `@IsString`, `@MaxLength(200)` | Razón social. |
| `taxId` | string | No | `@IsOptional`, `@IsString`, `@MaxLength(20)` | RUC/identificación fiscal. |
| `address` | string | No | `@IsOptional`, `@IsString`, `@MaxLength(255)` | Dirección. |
| `email` | string | No | `@IsOptional`, `@IsEmail` | Correo. |
| `phone` | string | No | `@IsOptional`, `@IsString` | Teléfono. |
| `timezone` | string | No | `@IsOptional`, `@IsString` | Por defecto `America/Lima`. |
| `currency` | string | No | `@IsOptional`, `@IsString` | Por defecto `PEN`. |

- **Respuesta**: `Company` creada (con `subscriptions`/`plan` si se creó).
- **Efectos secundarios**: crea `companies` (`status: TRIAL`, `trialEndsAt` = +7 días). Si existe plan `FREE`, crea `subscriptions` (`TRIALING`, `MONTHLY`, `endDate` = trial). Recalcula `profileComplete`/`profileCompletedAt`.
- **Errores**: `403` de rol/permiso; `409` de unicidad (`slug`) mapeado por el filtro; `400` validación.

### POST /api/companies/with-plan
- **Descripción**: Crea una empresa `TRIAL` con una suscripción asociada a un `planId` explícito.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')` + `@Permissions(Permission.COMPANY_MANAGE_ALL, Permission.SUBSCRIPTION_MANAGE)` (`company:manage_all` **y** `subscription:manage`).
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body (DTO `CreateCompanyWithPlanDto` = `CreateCompanyDto` + `planId`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| (todos los de `CreateCompanyDto`) | — | — | — | Ver tabla anterior. |
| `planId` | string | Sí | `@IsUUID()` | Plan de la suscripción a crear. |

- **Respuesta**: `Company` creada (con `subscriptions`/`plan`).
- **Efectos secundarios**: crea `companies` (`status: TRIAL`) y `subscriptions` (`TRIALING`, `MONTHLY`, `endDate` = +7 días, `planId` indicado). Fija `profileComplete`/`profileCompletedAt`.
- **Errores**: `403` de rol/permiso; `400` si `planId` no es UUID o validación; `409`/`400` de FK si el plan no existe (mapeado por el filtro); `409` de unicidad (`slug`).

### POST /api/companies/:id/approve
- **Descripción**: Aprueba una empresa: la pasa a `ACTIVE` y activa su suscripción.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')` + `@Permissions(Permission.COMPANY_MANAGE_ALL)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`.
- **Path params**: `id` (string).
- **Query**: ninguno.
- **Body**: ninguno.
- **Respuesta**: `Company` actualizada; si tiene suscripción, incluye `subscriptions`/`plan`.
- **Efectos secundarios**: actualiza `companies.status = ACTIVE`; si existe suscripción, actualiza `subscriptions.status = ACTIVE`.
- **Errores**: `404` (`Company not found.`); `403` de rol/permiso.

### POST /api/companies/:id/reject
- **Descripción**: Rechaza una empresa: la pasa a `SUSPENDED`.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')` + `@Permissions(Permission.COMPANY_MANAGE_ALL)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`.
- **Path params**: `id` (string).
- **Query**: ninguno.
- **Body**: ninguno.
- **Respuesta**: `Company` actualizada (`status: SUSPENDED`).
- **Efectos secundarios**: actualiza `companies.status = SUSPENDED`. No modifica la suscripción.
- **Errores**: `404` (`Company not found.`); `403` de rol/permiso.

### PATCH /api/companies/:id
- **Descripción**: Actualiza los datos de una empresa (administración global).
- **Auth**: JWT + `@Roles('SUPER_ADMIN')` + `@Permissions(Permission.COMPANY_MANAGE_ALL)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`.
- **Path params**: `id` (string).
- **Query**: ninguno.
- **Body (DTO `UpdateCompanyDto`)**: ver la tabla de `PATCH /api/companies/current` (mismos campos; `name` opcional).
- **Respuesta**: `Company` actualizada.
- **Efectos secundarios**: actualiza `companies`; recalcula `profileComplete`/`profileCompletedAt`.
- **Errores**: `404` (`Company not found.`); `403` de rol/permiso; `400` validación.

### PATCH /api/companies/:id/status
- **Descripción**: Cambia el estado (`status`) de una empresa.
- **Auth**: JWT + `@Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')` + `@Permissions(Permission.COMPANY_MANAGE_ALL)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`.
- **Path params**: `id` (string).
- **Query**: ninguno.
- **Body (DTO `UpdateCompanyStatusDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `status` | string | Sí | `@IsIn(['ACTIVE', 'SUSPENDED', 'TRIAL', 'PAST_DUE'])` | Nuevo estado. Nota: `INACTIVE` no es aceptado. |

- **Respuesta**: `Company` actualizada.
- **Efectos secundarios**: actualiza `companies.status`.
- **Errores**: `404` (`Company not found.`); `403` de rol/permiso; `400` validación.

## Funciones del servicio (`CompaniesService`)

### `findAll(page = 1, limit = 20)`
- **Qué hace**: Lista empresas paginadas en orden `createdAt desc`, incluyendo `subscriptions` (con `plan`, `take: 1`) y `_count` de `memberships`/`customers`.
- **Escribe en**: ninguna tabla (solo lectura).
- **Devuelve**: `{ data, total, page, limit, totalPages }`.
- **Lanza**: ninguna excepción propia.

### `findOne(id: string)`
- **Qué hace**: Busca una empresa por id incluyendo su suscripción/plan.
- **Escribe en**: ninguna tabla.
- **Devuelve**: `Company` con `subscriptions` (con `plan`, `take: 1`).
- **Lanza**: `NotFoundException` (404) si no existe.

### `create(input: CreateCompanyDto)`
- **Qué hace**: Crea una empresa `TRIAL` con `trialEndsAt` (+7 días) y, si existe el plan `FREE`, una suscripción `TRIALING` `MONTHLY`.
- **Escribe en**: `companies`, `subscriptions`.
- **Devuelve**: `Company` creada (con `subscriptions`/`plan`).
- **Lanza**: errores de Prisma (unicidad/FK) mapeados por el filtro.

### `createWithPlan(input: CreateCompanyDto & { planId: string })`
- **Qué hace**: Crea una empresa `TRIAL` con una suscripción `TRIALING` `MONTHLY` para el `planId` dado (`endDate` = +7 días).
- **Escribe en**: `companies`, `subscriptions`.
- **Devuelve**: `Company` creada (con `subscriptions`/`plan`).
- **Lanza**: errores de Prisma (FK de `planId` inválido, unicidad de `slug`) mapeados por el filtro.

### `approve(id: string)`
- **Qué hace**: Pasa la empresa a `ACTIVE` y, si tiene suscripción, la activa.
- **Escribe en**: `companies`, `subscriptions`.
- **Devuelve**: `Company` actualizada (con `subscriptions`/`plan` si aplica).
- **Lanza**: `NotFoundException` (404) si no existe.

### `reject(id: string)`
- **Qué hace**: Pasa la empresa a `SUSPENDED`.
- **Escribe en**: `companies`.
- **Devuelve**: `Company` actualizada.
- **Lanza**: `NotFoundException` (404) si no existe.

### `findCurrent(companyId: string)`
- **Qué hace**: Devuelve la empresa del tenant con su suscripción/plan.
- **Escribe en**: ninguna tabla.
- **Devuelve**: `Company` con `subscriptions` (con `plan`, `take: 1`).
- **Lanza**: `NotFoundException` (404) si no existe.

### `updateCurrent(companyId: string, input: UpdateCompanyDto)`
- **Qué hace**: Verifica existencia con `findCurrent` y actualiza la empresa; recalcula `profileComplete`/`profileCompletedAt`.
- **Escribe en**: `companies`.
- **Devuelve**: `Company` actualizada.
- **Lanza**: `NotFoundException` (404) si no existe.

### `update(companyId: string, input: UpdateCompanyDto)`
- **Qué hace**: Verifica existencia con `findOne` y actualiza la empresa; recalcula `profileComplete`/`profileCompletedAt`.
- **Escribe en**: `companies`.
- **Devuelve**: `Company` actualizada.
- **Lanza**: `NotFoundException` (404) si no existe.

### `updateStatus(companyId: string, input: UpdateCompanyStatusDto)`
- **Qué hace**: Verifica existencia con `findOne` y actualiza solo `status`.
- **Escribe en**: `companies`.
- **Devuelve**: `Company` actualizada.
- **Lanza**: `NotFoundException` (404) si no existe.

Método privado: `profileSync(input)` — evalúa `isProfileComplete` y devuelve `{ profileComplete, profileCompletedAt? }`.

## Notas
- `CompaniesService` no realiza auditoría, notificaciones ni caché.
- El cálculo de completitud usa `PROFILE_FIELDS` de `profile-completeness.helper.ts` (campos `taxId`, `legalName`, `address`, `phone`, `email` con pesos 30/25/20/15/10; ver `company-profile.md`).
- `findAll` devuelve la lista bajo la clave `data` (no `items`), a diferencia del patrón de paginación descrito en `convenciones-api.md`.
