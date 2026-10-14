# Plan: Activación y Aplicación Real de Planes (Suscripciones)

> Objetivo: que los planes (`Plan`) no sean solo precios/cupos informativos, sino
> **capacidades reales aplicadas** en todo el sistema: módulos habilitados,
> permisos finos, acceso a API, búsqueda DNI y cuota de API — forzados en backend
> (guards) y reflejados en frontend (UI/UX).
> Fuente de verdad del estado inicial: `docs/planes-configuracion-real.md`.

---

## 0. Alcance y decisiones bloqueadas

| Tema | Decisión |
|------|----------|
| Modelo | Se amplía `Plan` con `modules` (Json), `permissions` (Json), `apiEnabled`, `apiSearchDniEnabled`, `apiQuota` (Int) |
| Módulos | Lista de claves de módulo habilitadas por plan (ver matriz §2) |
| Permisos | Lista de capacidades finas (ej. `reports.advanced`, `inventory.batches`) |
| Búsqueda DNI | `apiSearchDniEnabled = true` **solo en SCALE** (GROWTH tiene API sin DNI) |
| Cuota API | GROWTH `10000` req/mes, SCALE `100000` req/mes; resto `0`. Se aplica 429 al exceder |
| Tabla `permissions` | **No existe**; el control de acceso por roles sigue vigente. `permissions` es capacidad de plan, no ACL de usuario |
| Gate de perfil | Se respeta `backend/src/common/helpers/profile-completeness.helper.ts` (bloquea checkout/upgrade de planes no-`FREE`) |
| Columna `Plan` | En prod `billingCycle`/`maxUsers`/`maxProducts` son **camelCase**; los campos nuevos usan snake_case |

---

## 1. Cambios de base de datos

- Migración `20261014040000_add_plan_modules_permissions_api`:
  añade `modules`, `permissions` (JSONB), `api_enabled`, `api_search_dni_enabled`,
  `api_quota` (Int, default 0).
- Migración `20261014041000_backfill_plan_capabilities`:
  backfill idempotente de `modules`, `permissions`, `api_*` por `code`.
- `start.sh` ejecuta `prisma migrate deploy` en cada deploy → las migraciones se
  aplican a producción automáticamente y de forma reproducible.

---

## 2. Matriz de capacidades por plan

### Módulos habilitados (`modules`)

| Módulo | FREE | START | GROWTH | SCALE |
|--------|:----:|:-----:|:------:|:-----:|
| dashboard | ✓ | ✓ | ✓ | ✓ |
| notifications | ✓ | ✓ | ✓ | ✓ |
| products | ✓ | ✓ | ✓ | ✓ |
| categories | ✓ | ✓ | ✓ | ✓ |
| inventory | ✓ | ✓ | ✓ | ✓ |
| sales | ✓ | ✓ | ✓ | ✓ |
| customers | ✓ | ✓ | ✓ | ✓ |
| distributors | — | ✓ | ✓ | ✓ |
| employees | — | ✓ | ✓ | ✓ |
| reports | ✓ | ✓ | ✓ | ✓ |
| api | — | — | ✓ | ✓ |
| api_search_dni | — | — | — | ✓ |
| webhooks | — | — | — | ✓ |

> Nota: el módulo `payments` fue retirado de la matriz. El controlador `payments`
> es facturación/suscripción (comprobantes, checkout, webhooks) y **no** debe
> gatearse por plan. El plan FREE incluye `reports` (con `reports.basic`) porque
> su beneficio comercial es "Reportes: Básico".

### Permisos finos (`permissions`)

| Capacidad | FREE | START | GROWTH | SCALE |
|-----------|:----:|:-----:|:------:|:-----:|
| reports.basic | ✓ | ✓ | ✓ | ✓ |
| reports.export | — | ✓ | ✓ | ✓ |
| sales.discounts | ✓ | ✓ | ✓ | ✓ |
| inventory.kardex | — | ✓ | ✓ | ✓ |
| reports.advanced | — | — | ✓ | ✓ |
| inventory.batches | — | — | ✓ | ✓ |
| inventory.multi_branch | — | — | ✓ | ✓ |
| api.access | — | — | ✓ | ✓ |
| api.dni_search | — | — | — | ✓ |
| webhooks.manage | — | — | — | ✓ |
| users.manage | — | — | — | ✓ |

### API

| Campo | FREE | START | GROWTH | SCALE |
|-------|:----:|:-----:|:------:|:-----:|
| `apiEnabled` | false | false | true | true |
| `apiSearchDniEnabled` | false | false | false | true |
| `apiQuota` (req/mes) | 0 | 0 | 10000 | 100000 |

Cupos ya existentes: `maxUsers` 1/3/10/999, `maxProducts` 50/500/5000/999999.

---

## 3. Fases

### Fase 1 — BD + backfill ✅ (completada)
- [x] Campos nuevos en `Plan` (schema + migración).
- [x] Backfill idempotente de módulos/permisos/API por plan.
- [x] Modelo `ApiUsage` (contador por empresa/periodo) — migración `20261014042000`.
- [x] `payments` retirado de los módulos — migración `20261014043000`.
- [x] FREE obtiene módulo `reports` (Reportes: Básico) — migración `20261014044000`.
- [x] Verificado en prod (Supabase): FREE 8 módulos, START 10, GROWTH 11, SCALE 13
      (sin `payments`); DNI solo SCALE; cuota GROWTH 10000 / SCALE 100000.

### Fase 2 — Backend (guards + límites) ✅ (completada)
- [x] `PlanCapabilitiesService`: resuelve el plan activo de la empresa + capacidades
      (fallback a `FREE`; cache 60 s; `invalidate` en mutaciones de suscripción).
- [x] Decoradores `@RequireModule('...')`, `@RequireFeature('...')`, `@RequirePlan('CODE')`.
- [x] `PlanCapabilitiesGuard` global (orden tras `JwtAuthGuard`/`RolesGuard`),
      403 `MODULE_NOT_ENABLED` / `FEATURE_NOT_AVAILABLE` / `PLAN_REQUIRED`;
      bypass para `SUPER_ADMIN`/`SUPPORT_ADMIN` y endpoints `@Public()`.
- [x] Reforzar `SubscriptionLimitService` (ahora vía `PlanCapabilitiesService`),
      403 `LIMIT_EXCEEDED` (código consumido por el frontend, no renombrar).
- [x] Cuota API: `ApiUsage` por empresa/periodo + `ApiQuotaGuard`,
      429 `API_QUOTA_EXCEEDED` (403 si el plan no incluye API).
- [x] Búsqueda DNI protegida con módulo `api_search_dni` + `api.dni_search`.
- [x] Módulos gateados: `products`, `categories`, `sales`, `customers`,
      `employees`, `distributors`, `inventory`, `kardex`, `product-batches`,
      `reports`, `branches`, `replenishment`, `stock-entries`, `dni`.
- [x] Endpoint `GET /api/plan-capabilities/me` (devuelve capacidades + uso API).
- [x] Validado localmente: FREE `products`/`reports` 200; `distributors`/`dni`
      403 `MODULE_NOT_ENABLED`; `kardex`/`product-batches` 403 `FEATURE_NOT_AVAILABLE`.

### Fase 3 — Frontend (UI/UX) ⏳
- [ ] `usePlanCapabilities()` + `can(module|feature)` leyendo el plan de la empresa.
- [ ] Ocultar/deshabilitar navegación y acciones no incluidas; CTA de upgrade.
- [ ] `plans-client.tsx` (público/admin) alineado con la matriz.

### Fase 4 — Seed/verificación
- [ ] Seed idempotente de planes con la matriz (para entornos nuevos).
- [ ] Pruebas de límites y gating.

### Fase 5 — Deploy + informe
- [ ] Commit (mensajes en español) + deploy + validación en prod.
- [ ] Informe final en `docs/informes/`.

---

## 4. Estados de error

| Código HTTP | `error` | Cuándo |
|-------------|---------|--------|
| 403 | `MODULE_NOT_ENABLED` | El plan no incluye el módulo |
| 403 | `FEATURE_NOT_AVAILABLE` | El plan no incluye la capacidad fina |
| 403 | `PLAN_REQUIRED` | La ruta exige un plan concreto (`@RequirePlan`) |
| 403 | `LIMIT_EXCEEDED` | Supera `maxUsers`/`maxProducts` (código consumido por el frontend) |
| 429 | `API_QUOTA_EXCEEDED` | Supera `apiQuota` del periodo |
