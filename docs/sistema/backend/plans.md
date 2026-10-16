# Módulo: Plans (planes de suscripción)

## Propósito
Gestiona el catálogo de planes de suscripción (`Plan`) de la plataforma: consulta pública de planes activos y CRUD administrativo. Los planes definen precio, ciclo de facturación, límites (`maxUsers`, `maxProducts`), módulos, features y cuota de API.

## Archivos clave
- `backend/src/modules/plans/plans.controller.ts` — endpoints REST bajo `plans`.
- `backend/src/modules/plans/plans.service.ts` — lógica de acceso a datos sobre `prisma.plan`.
- `backend/src/modules/plans/dto/plan.dto.ts` — `CreatePlanDto` y `UpdatePlanDto`.
- `backend/src/modules/plans/plans.module.ts` — importa `PrismaModule`, exporta `PlansService`.

## Endpoints

### GET /api/plans
- **Descripción**: Lista los planes activos (`isActive: true`) ordenados por `priceMonthly` ascendente. Uso público (catálogo).
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno (solo guards globales).
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta**: array de `Plan` (todos los campos del modelo).
- **Efectos secundarios**: ninguno.
- **Errores**: no verificado en el código (no se declaran errores propios; errores de BD se normalizan por el filtro global).

### POST /api/plans
- **Descripción**: Crea un plan.
- **Auth**: JWT + `@Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body (DTO `CreatePlanDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `code` | string | sí | `@IsString` | Código único del plan |
| `name` | string | sí | `@IsString` | Nombre del plan |
| `description` | string | no | `@IsOptional @IsString` | Descripción |
| `priceMonthly` | number | sí | `@IsNumber @Type(Number)` | Precio mensual |
| `priceYearly` | number | sí | `@IsNumber @Type(Number)` | Precio anual |
| `billingCycle` | `'MONTHLY'` \| `'YEARLY'` | sí | `@IsIn(['MONTHLY','YEARLY'])` | Ciclo de facturación |
| `maxUsers` | number | no | `@IsOptional @IsInt @Min(1)` | Máximo de usuarios |
| `maxProducts` | number | no | `@IsOptional @IsInt @Min(1)` | Máximo de productos |
| `features` | string[] | sí | `@IsArray` | Features (sin validar contra `PLAN_FEATURE_KEYS`) |
| `modules` | string[] | no | `@IsOptional @IsArray @IsIn(PLAN_MODULE_KEYS, {each:true})` | Módulos habilitados |
| `permissions` | string[] | no | `@IsOptional @IsArray @IsIn(PLAN_FEATURE_KEYS, {each:true})` | Se almacena en la columna `permissions` (usada como features por capacidades) |
| `apiEnabled` | boolean | no | `@IsOptional @IsBoolean` | API habilitada (def. `false`) |
| `apiSearchDniEnabled` | boolean | no | `@IsOptional @IsBoolean` | Búsqueda DNI (def. `false`) |
| `apiQuota` | number | no | `@IsOptional @IsInt @Min(0)` | Cuota de API (def. `0`) |
| `isActive` | boolean | no | `@IsOptional @IsBoolean` | Plan activo (def. `true`) |

- **Respuesta**: el `Plan` creado.
- **Efectos secundarios**: escribe en `plans`. No invalida cache de capacidades ni emite notificaciones.
- **Errores**: conflicto de `code` único → P2002 normalizado a 409 por el filtro global; body con campos no declarados → 400 (ValidationPipe global).

### PATCH /api/plans/:id
- **Descripción**: Actualiza un plan existente.
- **Auth**: JWT + `@Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: `id` (string) — ID del plan.
- **Query**: ninguno.
- **Body (DTO `UpdatePlanDto`)**: mismos campos que `CreatePlanDto` excepto `code` (no editable); todos opcionales.
- **Respuesta**: el `Plan` actualizado.
- **Efectos secundarios**: escribe en `plans` (actualiza solo los campos provistos). No invalida `plan:caps:<companyId>`.
- **Errores**: `404 Not Found` (`NotFoundException('Plan not found.')`) si el plan no existe.

### DELETE /api/plans/:id
- **Descripción**: Elimina un plan.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: `id` (string).
- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta**: el `Plan` eliminado.
- **Efectos secundarios**: elimina la fila en `plans`. Si hay suscripciones referenciando el plan, la FK puede impedir el borrado (error Prisma normalizado).
- **Errores**: `404 Not Found` si el plan no existe.

## Funciones del servicio (`PlansService`)

### `findPublicPlans()`
- **Qué hace**: `plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } })`.
- **Escribe en**: no escribe.
- **Devuelve**: array de planes activos.
- **Lanza**: nada explícito.

### `findAllAdmin()`
- **Qué hace**: `plan.findMany({ orderBy: { priceMonthly: 'asc' } })` (todos, activos e inactivos).
- **Escribe en**: no escribe.
- **Devuelve**: array de todos los planes.
- **Lanza**: nada explícito.
- **Nota**: no está expuesto por ningún endpoint del controlador (no verificado uso por otros módulos).

### `create(input: CreatePlanDto)`
- **Qué hace**: crea un plan aplicando defaults (`modules` y `permissions` → `[]`, `apiEnabled`/`apiSearchDniEnabled` → `false`, `apiQuota` → `0`, `isActive` → `true`).
- **Escribe en**: `plans`.
- **Devuelve**: el plan creado.
- **Lanza**: errores de Prisma (p. ej. P2002 por `code`).

### `update(id: string, input: UpdatePlanDto)`
- **Qué hace**: verifica existencia y aplica `plan.update({ where: { id }, data: input })`.
- **Escribe en**: `plans`.
- **Devuelve**: el plan actualizado.
- **Lanza**: `NotFoundException('Plan not found.')` si no existe.

### `remove(id: string)`
- **Qué hace**: verifica existencia y `plan.delete({ where: { id } })`.
- **Escribe en**: `plans` (delete).
- **Devuelve**: el plan eliminado.
- **Lanza**: `NotFoundException('Plan not found.')` si no existe.

## Observaciones
- El controlador no aplica `@RequireModule/@RequireFeature`; queda sujeto a los guards globales (`CsrfGuard`, `ThrottlerGuard`, `JwtAuthGuard`, `RolesGuard`, `PlanCapabilitiesGuard`).
- No hay invalidación de cache (`plan:caps:*`) al crear/editar/borrar planes, por lo que los cambios de módulos/features pueden tardar hasta 60s en reflejarse (TTL del cache).
