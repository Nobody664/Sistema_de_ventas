# Módulo: Plan Capabilities (capacidades de plan, gating y cuota de API)

## Propósito
Resuelve, cachea y expone las capacidades del plan activo de una empresa (módulos, features, cuota de API y límites), y proporciona el gating por plan (`@RequirePlan/@RequireModule/@RequireFeature` + `PlanCapabilitiesGuard`) y el consumo de cuota de API (`ApiQuotaService` + `ApiQuotaGuard`).

## Archivos clave
- `backend/src/modules/plan-capabilities/plan-capabilities.controller.ts` — endpoint `plan-capabilities/me`.
- `backend/src/modules/plan-capabilities/plan-capabilities.service.ts` — resolución y cache de capacidades.
- `backend/src/modules/plan-capabilities/api-quota.service.ts` — cuota mensual de API.
- `backend/src/modules/plan-capabilities/plan-capabilities.constants.ts` — keys y constantes.
- `backend/src/modules/plan-capabilities/decorators/require-plan.decorator.ts` — `@RequirePlan` / `REQUIRE_PLAN_KEY`.
- `backend/src/modules/plan-capabilities/decorators/require-module.decorator.ts` — `@RequireModule` / `REQUIRE_MODULE_KEY`.
- `backend/src/modules/plan-capabilities/decorators/require-feature.decorator.ts` — `@RequireFeature` / `REQUIRE_FEATURE_KEY`.
- `backend/src/modules/plan-capabilities/guards/plan-capabilities.guard.ts` — `PlanCapabilitiesGuard`.
- `backend/src/modules/plan-capabilities/guards/api-quota.guard.ts` — `ApiQuotaGuard`.
- `backend/src/modules/plan-capabilities/plan-capabilities.module.ts` — módulo `@Global()`; exporta `PlanCapabilitiesService` y `ApiQuotaService`.

Contexto complementario: [`../roles-permisos-planes.md`](../roles-permisos-planes.md).

## Constantes (`plan-capabilities.constants.ts`)

- `PLAN_MODULE_KEYS`: `dashboard`, `notifications`, `products`, `categories`, `inventory`, `sales`, `customers`, `distributors`, `employees`, `reports`, `api`, `api_search_dni`, `webhooks`.
- `PLAN_FEATURE_KEYS`: `reports.basic`, `reports.advanced`, `reports.export`, `sales.discounts`, `inventory.kardex`, `inventory.batches`, `inventory.multi_branch`, `api.access`, `api.dni_search`, `webhooks.manage`, `users.manage`.
- `CORE_MODULES = ['dashboard', 'notifications']`; `CORE_FEATURES = []`.
- `FALLBACK_PLAN_CODE = 'FREE'`.

## Endpoints

### GET /api/plan-capabilities/me
- **Descripción**: Devuelve las capacidades del plan del usuario y el uso de cuota de API del periodo actual. Para admins globales o usuarios sin `companyId`, devuelve un objeto con todos los módulos/features y límites en `Number.MAX_SAFE_INTEGER`.
- **Auth**: JWT (guard a nivel de clase).
- **Plan**: ninguno (es el endpoint que las expone).
- **Guards extra**: `@UseGuards(JwtAuthGuard)` a nivel de `@Controller`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta**:
  - Admin global / sin empresa: `{ planId: null, planCode: 'GLOBAL_ADMIN', planName: 'Administrador', modules: [...PLAN_MODULE_KEYS], features: [...PLAN_FEATURE_KEYS], apiEnabled: true, apiSearchDniEnabled: true, apiQuota: 0, maxUsers: Number.MAX_SAFE_INTEGER, maxProducts: Number.MAX_SAFE_INTEGER, apiUsage: { allowed: true, used: 0, limit: 0, remaining: 0, period: '' } }`.
  - Empresa normal: `{ ...capabilities, apiUsage }` donde `capabilities` es el resultado de `getCapabilities` y `apiUsage` el de `ApiQuotaService.getUsage`.
- **Efectos secundarios**: puede escribir cache `plan:caps:<companyId>` (TTL 60s) al resolver por primera vez.
- **Errores**: ninguno explícito.

## `PlanCapabilitiesService`

### `getCapabilities(companyId)`
- **Qué hace**: lee de cache `plan:caps:<companyId>`; si no hay, resuelve con `resolveCapabilities` y guarda el resultado 60s.
- **Escribe en**: cache (`plan:caps:<companyId>`, TTL `CACHE_TTL_SECONDS = 60`).
- **Devuelve**: `PlanCapabilities` `{ planId, planCode, planName, modules[], features[], apiEnabled, apiSearchDniEnabled, apiQuota, maxUsers, maxProducts }`.
- **Lanza**: nada explícito (los errores de resolución se registran y caen al fallback).

### `invalidate(companyId)`
- **Qué hace**: elimina la clave `plan:caps:<companyId>` del cache.
- **Escribe en**: cache (delete).
- **Devuelve**: `void`.
- **Lanza**: nada explícito.

### `hasModule(capabilities, module)`
- **Qué hace**: `true` si `module` está en `CORE_MODULES` o en `capabilities.modules`.
- **Escribe en**: no escribe.
- **Devuelve**: boolean.
- **Lanza**: nada.

### `hasFeature(capabilities, feature)`
- **Qué hace**: `true` si `feature` está en `capabilities.features`.
- **Escribe en**: no escribe.
- **Devuelve**: boolean.
- **Lanza**: nada.

### `resolveCapabilities(companyId)` (privada)
- **Qué hace**:
  1. Busca la `Subscription` más reciente de la empresa (con `plan`). Si su `status` está en `ACTIVE_SUBSCRIPTION_STATUSES` (`['ACTIVE', 'TRIALING']`) y tiene `plan`, usa ese plan.
  2. Si no, busca el plan con `code = 'FREE'` (`FALLBACK_PLAN_CODE`).
  3. Si todo falla (o hay excepción, que se registra con `logger.warn`), devuelve `fallbackCapabilities`.
- **Escribe en**: no escribe.
- **Devuelve**: `PlanCapabilities`.
- **Lanza**: no propaga; captura y registra.

### `fromPlan(plan)` (privada)
- **Qué hace**: convierte un `Plan` a `PlanCapabilities`; `modules` desde la columna `modules` y `features` desde la columna `permissions` (ambas `Json`, filtradas a strings).
- **Devuelve**: `PlanCapabilities`.

### `fallbackCapabilities()` (privada)
- **Qué hace**: capacidades de respaldo con módulos core, sin features, API off, `maxUsers=1`, `maxProducts=50`, `planCode='FREE'`.

### `toStringArray(value)` (privada)
- **Qué hace**: filtra un `JsonValue` a `string[]`; devuelve `[]` si no es array.

## `ApiQuotaService`

### `getUsage(companyId)`
- **Qué hace**: obtiene capacidades y el periodo `YYYY-MM` (UTC); lee `api_usage` por `(companyId, period)`.
- **Escribe en**: no escribe.
- **Devuelve**: `{ allowed, used, limit, remaining, period }`; `allowed = limit > 0 && used < limit`.
- **Lanza**: nada explícito.

### `consume(companyId, amount = 1)`
- **Qué hace**: obtiene capacidades y periodo; si `apiEnabled` es falso o `apiQuota <= 0` lanza `FEATURE_NOT_AVAILABLE`; si `used + amount > apiQuota` lanza `API_QUOTA_EXCEEDED`; si no, hace upsert incrementando `count`.
- **Escribe en**: `api_usage` (upsert por `companyId_period`).
- **Devuelve**: `{ allowed: true, used, limit, remaining, period }`.
- **Lanza**: `HttpException` 403 `FEATURE_NOT_AVAILABLE`; `HttpException` 429 `API_QUOTA_EXCEEDED`.

### `currentPeriod(date?)` (privada)
- **Qué hace**: devuelve `YYYY-MM` en UTC (`getUTCFullYear` / `getUTCMonth`).

## Guard: `PlanCapabilitiesGuard`

Registrado globalmente (`APP_GUARD` en `app.module.ts`), actúa solo si el handler/clase tiene metadata de `@RequirePlan`, `@RequireModule` o `@RequireFeature`.

- **Qué hace** (`canActivate`):
  1. Lee `REQUIRE_PLAN_KEY`, `REQUIRE_MODULE_KEY`, `REQUIRE_FEATURE_KEY` (de handler y clase). Si no hay ninguna, permite (`true`).
  2. Si el endpoint es `@Public()`, permite.
  3. Si no hay `request.user`, permite (el gating real lo hacen otros guards).
  4. Si el usuario tiene rol en `GLOBAL_ADMIN_ROLES` (`SUPER_ADMIN`, `SUPPORT_ADMIN`), permite.
  5. Si no hay `companyId`, permite.
  6. Resuelve capacidades; si `requiredPlan` no coincide con `planCode` → 403 `PLAN_REQUIRED`; si faltan módulos → 403 `MODULE_NOT_ENABLED` con `modules`; si faltan features → 403 `FEATURE_NOT_AVAILABLE` con `features`. Todos incluyen `currentPlan` y `upgradeUrl: '/subscription'`.
- **Efectos secundarios**: puede resolver/escribir cache vía `getCapabilities`.
- **Códigos de error**: `PLAN_REQUIRED` (403), `MODULE_NOT_ENABLED` (403), `FEATURE_NOT_AVAILABLE` (403).

## Guard: `ApiQuotaGuard`

Guard por endpoint (no global). Debe aplicarse explícitamente con `@UseGuards(ApiQuotaGuard)` (usado por el módulo `dni`, ver `backend/src/modules/dni/dni.controller.ts`).

- **Qué hace** (`canActivate`): si no hay `user`, permite; si el usuario es admin global (`SUPER_ADMIN`/`SUPPORT_ADMIN`), permite sin consumir; si no hay `companyId`, permite; si no, llama a `apiQuota.consume(companyId)` y permite.
- **Efectos secundarios**: consume 1 unidad de cuota de API (escribe `api_usage`).
- **Errores**: propaga los de `ApiQuotaService.consume` (`FEATURE_NOT_AVAILABLE` 403, `API_QUOTA_EXCEEDED` 429).

## Decoradores

- `@RequirePlan(planCode: string)` → `SetMetadata('requirePlan', planCode)`. Error asociado: `PLAN_REQUIRED` (403).
- `@RequireModule(...modules: PlanModuleKey[])` → `SetMetadata('requireModule', modules)`. Error: `MODULE_NOT_ENABLED` (403).
- `@RequireFeature(...features: PlanFeatureKey[])` → `SetMetadata('requireFeature', features)`. Error: `FEATURE_NOT_AVAILABLE` (403).

## Observaciones
- No existe en este módulo un decorador `@LimitResource` ni un `SubscriptionLimitService`/`SubscriptionLimitGuard`; según `roles-permisos-planes.md` esos límites (`LIMIT_EXCEEDED`) residen en otro módulo. **No verificado en el código de este módulo.**
- El cache usa `CacheService` con TTL fijo de 60s; `invalidate` debe ser llamado tras cambios de plan/suscripción (lo hacen `SubscriptionsService` y `PlanUpgradeRequestsService`, pero no todos los flujos de `PaymentsService`).
