# Roles, Permisos y Planes

Fuente: `backend/src/common/constants/permissions.constant.ts`,
`backend/src/modules/plan-capabilities/`, `backend/prisma/seed.ts`.

## Dos capas de autorización

1. **Rol** (`@Roles(...)` + `RolesGuard`) y **Permiso** (`@Permissions(...)` + `PermissionsGuard`).
   - Los roles globales del `User` y el rol de su `Membership` se combinan en el claim `roles`.
   - `ROLE_PERMISSIONS` mapea rol → permisos. `SUPER_ADMIN` omite toda comprobación.
2. **Capacidades de plan** (`PlanCapabilitiesGuard` + `@RequirePlan/@RequireModule/@RequireFeature`).
   - Admins globales (`SUPER_ADMIN`, `SUPPORT_ADMIN`) omiten la comprobación.

## Roles globales (`GlobalRole`)

- `SUPER_ADMIN`: acceso total (omite roles y permisos).
- `SUPPORT_ADMIN`: acceso al área de plataforma (ver permisos abajo).
- `ADMIN`, `USER`: sin permisos en `ROLE_PERMISSIONS` (comportamiento por defecto: **sin permisos**).

## Roles de empresa (`MembershipRole`)

`COMPANY_ADMIN`, `MANAGER`, `CASHIER`, `VIEWER`, `DISTRIBUTOR`.

### Matriz de permisos (`ROLE_PERMISSIONS`)

| Permiso | COMPANY_ADMIN | MANAGER | CASHIER | VIEWER | SUPPORT_ADMIN |
|---------|:---:|:---:|:---:|:---:|:---:|
| `product:list` | ✓ | ✓ | ✓ | ✓ | |
| `product:create` | ✓ | ✓ | | | |
| `product:update` | ✓ | ✓ | | | |
| `product:delete` | ✓ | | | | |
| `product:export` | ✓ | ✓ | | | |
| `product:view_low_stock` | ✓ | ✓ | | | |
| `category:list` | ✓ | ✓ | | | |
| `category:create` | ✓ | ✓ | | | |
| `category:update` | ✓ | ✓ | | | |
| `category:delete` | ✓ | | | | |
| `customer:list` | ✓ | ✓ | ✓ | ✓ | |
| `customer:create` | ✓ | ✓ | ✓ | | |
| `customer:update` | ✓ | ✓ | ✓ | | |
| `customer:delete` | ✓ | | | | |
| `employee:list` | ✓ | ✓ | | | |
| `employee:create` | ✓ | ✓ | | | |
| `employee:update` | ✓ | | | | |
| `employee:delete` | ✓ | | | | |
| `sale:list` | ✓ | ✓ | ✓ | ✓ | |
| `sale:create` | ✓ | ✓ | ✓ | | |
| `sale:view_detail` | ✓ | ✓ | ✓ | ✓ | |
| `sale:cancel` | ✓ | ✓ | | | |
| `sale:export` | ✓ | ✓ | | | |
| `inventory:view` | ✓ | ✓ | | | |
| `inventory:inbound` | ✓ | ✓ | | | |
| `inventory:outbound` | ✓ | ✓ | | | |
| `inventory:adjust` | ✓ | ✓ | | | |
| `cash:open_close` | ✓ | ✓ | ✓ | | |
| `cash:view_report` | ✓ | ✓ | ✓ | | |
| `dashboard:view` | ✓ | ✓ | ✓ | ✓ | |
| `report:sales` | ✓ | ✓ | ✓ | ✓ | |
| `report:financial` | ✓ | ✓ | | | |
| `company:view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `company:update` | ✓ | | | | |
| `company:manage_plans` | | | | | |
| `company:view_audit` | | | | | |
| `company:manage_all` | | | | | ✓ |
| `subscription:view` | ✓ | ✓ | | ✓ | ✓ |
| `subscription:manage` | | | | | ✓ |
| `user:manage` | | | | | ✓ |
| `kardex:view` | ✓ | ✓ | | | |
| `kardex:export` | ✓ | | | | |
| `replenishment:view` | ✓ | ✓ | | | |
| `replenishment:manage` | | | | | |
| `forecast:view` | ✓ | | | | |
| `branch:manage` | | | | | |
| `distributor:list` | ✓ | ✓ | | | |
| `distributor:create` | ✓ | ✓ | | | |
| `distributor:update` | ✓ | ✓ | | | |
| `distributor:delete` | ✓ | | | | |
| `distributor:view` | ✓ | ✓ | | | |
| `distributor:transfer` | ✓ | ✓ | | | |
| `distributor:deliver` | ✓ | ✓ | | | |
| `distributor:settle` | ✓ | | | | |
| `discount:list` | ✓ | ✓ | ✓ | | |
| `discount:manage` | ✓ | | | | |
| `platform:view` | | | | | ✓ |
| `platform:companies_manage` | | | | | |
| `platform:plans_manage` | | | | | |
| `platform:settings_manage` | | | | | |
| `platform:admins_manage` | | | | | |
| `platform:audit_view` | | | | | ✓ |

> `COMPANY_MANAGE_ALL`, `COMPANY_MANAGE_PLANS`, `COMPANY_VIEW_AUDIT` y los `PLATFORM_*_MANAGE`
> existen en el enum pero no están asignados a `SUPPORT_ADMIN` (solo `platform:view` y
> `platform:audit_view`). Quien realmente puede todo es `SUPER_ADMIN`.

## Módulos de plan (`PlanModuleKey`)

Keys válidas: `dashboard`, `notifications`, `products`, `categories`, `inventory`, `sales`,
`customers`, `distributors`, `employees`, `reports`, `api`, `api_search_dni`, `webhooks`.

`CORE_MODULES = ['dashboard', 'notifications']` → siempre disponibles aunque el plan no los liste.

## Features de plan (`PlanFeatureKey`)

`reports.basic`, `reports.advanced`, `reports.export`, `sales.discounts`, `inventory.kardex`,
`inventory.batches`, `inventory.multi_branch`, `api.access`, `api.dni_search`, `webhooks.manage`,
`users.manage`.

## Composición por plan (valores reales)

Datos de `plans` según `seed.ts` + migraciones de backfill (módulos/permisos se leen de la columna
`modules` / `permissions` del plan; el seed base NO los setea, los aplica la migración).

| Plan | Precio/mes | `maxUsers` | `maxProducts` | Módulos | Features | API |
|------|-----------:|-----------:|--------------:|---------|----------|-----|
| **FREE** | 0 | 1 | 50 | dashboard, notifications, products, categories, inventory, sales, customers, reports | reports.basic, sales.discounts | off |
| **START** | 49 | 3 | 500 | + distributors, employees, payments, reports | + reports.export, inventory.kardex | off |
| **GROWTH** | 99 | 10 | 5000 | + api | + reports.advanced, inventory.batches, inventory.multi_branch, api.access | on, cuota 10000 |
| **SCALE** | 199 | 999 | 999999 | + api_search_dni, webhooks | + api.dni_search, webhooks.manage, users.manage | on, cuota 100000 |

> El plan **FREE incluye `reports`** (migración `20261014044000_free_plan_reports_module`).
> `payments` aparece en módulos de START/GROWTH/SCALE; FREE no lo lista.

## Límites derivados (`SubscriptionLimitService`)

`getSubscriptionLimits()` deriva límites del plan activo:

- `maxUsers` y `maxProducts` → del plan.
- `maxCustomers = maxProducts × 5`.
- `maxEmployees = maxUsers`.
- `maxCategories = max(1, floor(maxProducts / 20))`.

Recursos validados con `SubscriptionLimitGuard` + `@LimitResource(...)`:
`products`, `users`, `customers`, `employees`, `categories`, `sales`.

Al exceder el límite se lanza **403** con cuerpo
`{ error: 'LIMIT_EXCEEDED', message, current, limit, resource, planName, upgradeUrl }`.

## Resolución de capacidades (`PlanCapabilitiesService`)

`getCapabilities(companyId)` (cacheado 60s en `plan:caps:<companyId>`):

1. Busca la `Subscription` más reciente de la empresa. Si su `status` es `ACTIVE` o `TRIALING`
   y tiene `plan`, usa ese plan.
2. Si no, usa el plan con `code = 'FREE'`.
3. Si todo falla, devuelve capacidades fallback (módulos core, `maxUsers=1`, `maxProducts=50`).

Devuelve `{ planId, planCode, planName, modules[], features[], apiEnabled, apiSearchDniEnabled,
apiQuota, maxUsers, maxProducts }`.

## Cuota de API (`ApiQuotaService`)

- Periodo = `YYYY-MM` (UTC). Contador en `api_usage` por `(companyId, period)`.
- `consume(companyId)`: si el plan no tiene `apiEnabled` o `apiQuota<=0` → **403**
  `FEATURE_NOT_AVAILABLE`. Si `used + amount > apiQuota` → **429** `API_QUOTA_EXCEEDED`.
  Si no, incrementa el contador (upsert).
- El guard `ApiQuotaGuard` no consume para admins globales.

## Códigos de error de gating (no renombrar)

| Código | HTTP | Origen |
|--------|-----:|--------|
| `PLAN_REQUIRED` | 403 | `@RequirePlan` |
| `MODULE_NOT_ENABLED` | 403 | `@RequireModule` |
| `FEATURE_NOT_AVAILABLE` | 403 | `@RequireFeature` / API sin plan |
| `API_QUOTA_EXCEEDED` | 429 | `ApiQuotaService.consume` |
| `LIMIT_EXCEEDED` | 403 | `SubscriptionLimitService.validateLimit` |
