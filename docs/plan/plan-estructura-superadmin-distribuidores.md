# Plan de desarrollo — Estructura de plataforma (SUPER_ADMIN) separada + Distribuidores

> Estado: **por ejecutar** · Fecha: 2026-10-09 · Documento hermano: `docs/plan/diagramas-estructura-superadmin.md`

---

## 1. Objetivo

Separar de forma explícita y verificable **tres dominios** que hoy están mezclados en la misma lógica:

| Dominio | Quién | Qué administra | Hoy |
|---|---|---|---|
| **Plataforma** | `SUPER_ADMIN` (yo, creador del sistema) y `SUPPORT_ADMIN` | El sistema en sí: empresas, planes, configuración global de pagos, métricas globales, auditoría global, otros administradores de soporte. **Sin contexto de tenant.** | Mezclado en rutas `/companies`, `/subscriptions`, `/audit`, `/settings/payment` que comparten `TenantGuard`/`data-app` con el tenant |
| **Tenant (Empresa)** | `COMPANY_ADMIN` (dueño) y su staff (`MANAGER`, `CASHIER`, `VIEWER`) | Su empresa: productos, ventas, inventario, empleados, reportes, su suscripción | Correcto, pero con sidebar/páginas mezcladas con roles de plataforma |
| **Distribuidores** | Nueva entidad dentro de cada empresa | Distribuyen/venden los productos de la empresa fuera de la caja principal | **No existe** |

Regla central del diseño: **la lógica de plataforma nunca se cruza con la de tenant**. El SUPER_ADMIN no "es un empresa-admin con más permisos"; es un rol con su **espacio de datos, rutas, guards y UI propios**.

---

## 2. Diagnóstico del estado actual

Fuentes verificadas: `backend/prisma/schema.prisma`, `backend/src/common/guards/*`, `backend/src/app.module.ts`, `frontend/proxy.ts`, `frontend/app/(dashboard)/layout.tsx`, `frontend/components/layout/app-sidebar.tsx`.

1. **Un solo `User` y un solo `globalRole`** (`GlobalRole { SUPER_ADMIN, SUPPORT_ADMIN, ADMIN, USER }`); `SUPER_ADMIN` "funciona" mediante bypass en `RolesGuard`/`PermissionsGuard` y mediante `TenantGuard` "salvo contexto". Eso hace que un SUPER_ADMIN pueda terminar en rutas de tenant que no le corresponden.
2. **Rutas de plataforma dentro del grupo `(dashboard)`**: `/companies`, `/subscribers`, `/upgrade-requests`, `/subscriptions`, `/invoices/templates`, `/audit`, `/settings/payment` viven en el mismo layout que las páginas de empresa.
3. **Enforcement inconsistente** (ya mapeado): 9 rutas verifican rol, el resto delega en el backend y el frontend recibe `null` silencioso (`serverApiFetch` no lanza errores ante 403).
4. **Permisos drift entre frontend y backend** (`frontend/types/permissions.ts` vs `backend/src/common/constants/permissions.constant.ts`): faltan `kardex:*`, `replenishment:*`, `forecast:view`, `branch:manage`; sobran `settings:read/update`.
5. **No existe distribuidor**: no hay modelo, módulo, permisos ni UI.
6. **No hay guard global de rutas por rol**: `frontend/proxy.ts` solo valida cookie y estado de compañía; `(dashboard)/layout.tsx` solo valida sesión/`companyStatus`.

---

## 3. Arquitectura objetivo

### 3.1 Separación de dominios

```
GLOBAL / PLATAFORMA     → módulo nestjs `platform`, prefijo /platform/*, PlatformGuard, app/(platform)
TENANT / EMPRESA        → módulos existentes, prefijo /api/*, TenantGuard, app/(dashboard)
DISTRIBUIDORES (tenant) → módulo nestjs `distributors`, prefijo /api/distributors/*, TenantGuard
```

Patrones de la skill `nestjs-best-practices` aplicados:
- `arch-feature-modules` — organización por dominio, no por capa.
- `arch-single-responsibility` — servicios enfocados, sin "god services".
- `security-use-guards` — autorización en guards dedicados por dominio.
- `db-use-migrations` — todo cambio de esquema con migración Prisma.
- `db-use-transactions` — operaciones multi-tabla (distribuidor + stock) en `$transaction`.

Patrones de la skill `next-best-practices` aplicados:
- Route groups `(platform)` / `(dashboard)` para separar layout y sidebar.
- `proxy.ts` (middleware v16) para enrutar por rol global.
- Server Components con `getServerSession()` + guard temprano; datos con `serverApiFetch`.

### 3.2 Modelo de roles alineado con las 3 capas

```prisma
enum GlobalRole {
  SUPER_ADMIN      // dueño de la plataforma
  SUPPORT_ADMIN    // soporte operativo (solo lectura + gestión acotada)
  ADMIN            // DEPRECADO → eliminar tras migración (hoy sin uso)
  USER             // base por defecto
}

enum MembershipRole {
  COMPANY_ADMIN
  MANAGER
  CASHIER
  VIEWER
  DISTRIBUTOR      // NUEVO: contexto de acceso del distribuidor a la app de la empresa
}
```

> **Por qué `DISTRIBUTOR` es un `MembershipRole`:** los distribuidores necesitan iniciar sesión con alcance de empresa (mismo `User` + `Membership` + `TenantGuard`), pero su **perfil comercial** vive en una tabla nueva `Distributor`. Así no se duplica auth ni se contamina el modelo `Employee`.

### 3.3 Nuevo espacio de permisos `platform:*` (separado de los de tenant)

```ts
// plataforma (solo SUPER_ADMIN / SUPPORT_ADMIN)
'platform:view_companies'    'platform:manage_companies'
'platform:view_metrics'      'platform:manage_plans'
'platform:manage_settings'   // pagos globales, brand, etc.
'platform:manage_admins'     // alta/baja de SUPPORT_ADMIN
'platform:audit'
'platform:view_subscriptions'  'platform:review_requests'

// distribuidores (tenant)
'distributor:list'  'distributor:create'  'distributor:update'  'distributor:delete'
'distributor:transfer'   // envío de mercadería
'distributor:sell'       // registrar ventas del distribuidor
'distributor:settle'     // liquidación / comisiones
```

Los `ROLE_PERMISSIONS` del frontend y los `ROLE_PERMISSIONS` del backend pasan a ser **dos fuentes sincronizadas por un único archivo compartido o por verificación en CI** (evitar el drift que ya existe).

---

## 4. Cambios de modelo de datos (Prisma)

Archivos: `backend/prisma/schema.prisma` + migración en `backend/prisma/migrations/`.

### 4.1 Plataforma (separación de datos)

- **No se duplica `User`.** Se conserva `User.globalRole` como identidad única (evita migración destructiva y re-login). La separación es de **espacio lógico**: rutas, guard, módulo y UI.
- Nuevas tablas de plataforma (sin `companyId`, por diseño **no tenant**):
  - `PlatformSetting` (singleton): marca, moneda por defecto, trialDays, feature flags, config de notificaciones.
  - `PlatformAuditLog`: auditoría global (`action`, `entity`, `entityId`, `changes`, `ipAddress`, `userAgent`) — separada de `AuditLog` que es por compañía.
  - `SupportAccount` (opcional, fase posterior): perfil extra de `SUPPORT_ADMIN` (turno, alcance, notas). Puede empezar como columna simple en `User`.

### 4.2 Distribuidores (nuevas tablas tenant-scoped)

```prisma
model Distributor {
  id            String   @id @default(cuid())
  companyId     String   @map("company_id")
  code          String                      // SKU/distribuidor único por empresa
  name          String
  documentType  String?                     // DNI / RUC
  documentValue String?
  email         String?
  phone         String?
  address       String?
  type          DistributorType @default(INDIVIDUAL)   // INDIVIDUAL | COMPANY
  status        DistributorStatus @default(ACTIVE)     // ACTIVE | SUSPENDED | BLOCKED
  commissionRate Decimal? @db.Decimal(5,2)  // % sobre venta
  priceListId   String?                     // lista de precios (extensión futura)
  notes         String?
  deletedAt     DateTime?  @map("deleted_at")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  userId      String?  @unique @map("user_id")   // vínculo opcional a cuenta de acceso
  company     Company @relation(...)
  user        User?   @relation(...)
  movements   InventoryMovement[]
  sales       Sale[]
  balances    DistributorBalance[]
  deliveries  DistributorDelivery[]

  @@unique([companyId, code])
  @@index([companyId, status])
}
```

Relaciones de apoyo:
- `InventoryMovement.distributorId String?` — mercadería enviada (`type = TRANSFER`), devuelta (`RETURN`), vendida (`OUT` con canal distribuidor).
- `Sale.distributorId String?` + `Sale.channel SaleChannel` (`POS | DISTRIBUTOR | ONLINE`).
- `DistributorBalance` — saldo/consignación por distribuidor (qty inicial, qty devuelta, qty vendida, deuda).
- `DistributorDelivery` — despachos/entregas con `status` y detalle de items.

Se **reutilizan** `InventoryMovement` y `Sale` en lugar de duplicar tablas de inventario/ventas: regla `db-use-transactions` y evitar dos fuentes de verdad de stock.

### 4.3 Semántica de inventario con distribuidor

- `TRANSFER` = salida a consignación (stock sale del almacén, no es costo de venta todavía).
- `SALE` con `channel = DISTRIBUTOR` = venta reportada → genera la transacción de costo (Kardex).
- `RETURN` = devolución a almacén → restaura disponibilidad.
- Todo dentro de `$transaction` (Prisma 7: usar `$transaction(async (tx) => …)`).

---

## 5. Cambios de backend (NestJS)

### 5.1 Módulo nuevo `backend/src/modules/platform/`

```
src/modules/platform/
├── dto/
├── platform.module.ts
├── platform.controller.ts        // prefijo /platform
├── platform-companies.controller.ts   // /platform/companies  (CRUD global, suspender/activar)
├── platform-plans.controller.ts       // /platform/plans
├── platform-settings.controller.ts    // /platform/settings (pagos globales = hoy /api/payment-settings)
├── platform-metrics.controller.ts     // /platform/metrics
├── platform-audit.controller.ts       // /platform/audit
└── platform-companies.service.ts … etc.
```

- `PlatformGuard` nuevo (`src/common/guards/platform.guard.ts`): exige `globalRole ∈ {SUPER_ADMIN, SUPPORT_ADMIN}` y **rechaza explícitamente** cualquier `companyId`/tenant context. Registrado con `@UseGuards(PlatformGuard, PermissionsGuard)` a nivel de módulo, **sin** `TenantGuard`.
- Ruta actual `/api/payment-settings` se **mueve** a `/platform/settings/payment` (se mantiene alias temporal por compatibilidad).
- `api-versioning`/prefijo: `/platform` queda fuera del `/api` que consume el tenant → la separación es observable en red.

### 5.2 Módulo nuevo `backend/src/modules/distributors/`

```
src/modules/distributors/
├── dto/
├── distributors.module.ts
├── distributors.controller.ts     // /api/distributors  (TenantGuard + @Roles)
├── distributor-sales.controller.ts
├── distributor-inventory.controller.ts  // transfers/returns
├── distributors.service.ts
└── distributor-settlement.service.ts
```

- `@Roles(COMPANY_ADMIN, MANAGER)` para gestión; `distributor:*` vía `@Permissions` para operaciones.
- `arch-avoid-circular-deps`: `DistributorsModule` importa `PrismaModule` + `InventoryModule`/`SalesModule` (o se comunica por eventos con `arch-use-events`) sin depender de `PlatformModule`.

### 5.3 Endpoints existentes que se reubican

| Hoy | Nuevo |
|---|---|
| `GET/PATCH /api/payment-settings` (SUPER_ADMIN) | `GET/PATCH /platform/settings/payment` |
| `GET /api/companies` (global) | `GET /platform/companies` |
| `GET /api/plans` (admin) + público checkout | `GET /platform/plans` (admin) y `GET /api/plans` (público, `@Public()`) |
| `GET /api/audit/global` | `GET /platform/audit` |

### 5.4 Sincronización de permisos

- Crear `backend/src/common/constants/permissions.constant.ts` y `frontend/types/permissions.ts` a partir de **una única fuente** (p. ej. `shared/permissions.ts` generado) o añadir un test/CI que falle si difieren.
- Añadir permisos `platform:*` y `distributor:*`; eliminar `settings:read/update` (no existen en backend) o implementarlos.

---

## 6. Cambios de frontend (Next.js)

### 6.1 Estructura de rutas

```
frontend/app/
├── (dashboard)/          # TENANT — solo roles de empresa
│   ├── dashboard/  inventory/  products/  categories/
│   ├── sales/  customers/  employees/  reports/  payments/
│   ├── subscription/  settings/company/  notifications/
│   └── distributors/     # NUEVO
│
├── (platform)/           # PLATAFORMA — solo SUPER_ADMIN/SUPPORT_ADMIN
│   ├── layout.tsx        # sidebar propio, data-platform
│   ├── platform/
│   │   ├── overview/     # métricas globales
│   │   ├── companies/
│   │   ├── subscribers/
│   │   ├── upgrade-requests/
│   │   ├── plans/
│   │   ├── templates/    # invoice templates globales
│   │   ├── settings/     # pagos globales
│   │   ├── audit/
│   │   └── admins/       # gestión de SUPPORT_ADMIN
```

### 6.2 Enrutado por rol (proxy)

`frontend/proxy.ts`:
- `/platform/*` → exige sesión + `globalRole ∈ {SUPER_ADMIN, SUPPORT_ADMIN}`; si no → `/forbidden` (o `/sign-in` si no hay sesión).
- `/dashboard`, `/inventory`, `/sales`, … → exige sesión + al menos un `MembershipRole`; si no → `/forbidden`.
- Estado de compañía (`INACTIVE`/`SUSPENDED`) solo aplica a rutas tenant, **no** a `/platform`.

### 6.3 Layouts y tema

- `app/(platform)/layout.tsx` → `<div data-platform>…` con sidebar propio (secciones: Resumen, Empresas, Solicitudes, Planes, Plantillas, Pagos globales, Auditoría, Administradores).
- `app/(dashboard)/layout.tsx` pierde las secciones "Plataforma" y "Sistema" del sidebar actual (`app-sidebar.tsx` se divide en `sidebar-platform.tsx` y `sidebar-tenant.tsx`).
- El sistema de tema oscuro ya soporta `data-app`; se amplía el selector a `.dark :is([data-app], [data-platform])` en `frontend/app/globals.css`.

### 6.4 Sincronización de permisos (ya iniciada)

- `frontend/types/permissions.ts` y `ROLE_PERMISSIONS`: reflejar `platform:*`, `distributor:*`, quitar `employee:create` de `MANAGER` (hecho), quitar `VIEWER` de Productos en sidebar (hecho).
- Cada página de `(platform)` usa `PlatformGuard`/`redirect()` temprano en Server Component; cada página de tenant usa su guard correspondiente.

---

## 7. Fases de ejecución

### Fase 0 — Fundación de separación (sin cambio de datos) ✅ *(hacer primero, bajo riesgo)*
1. Crear `PlatformGuard` + prefijo `/platform` con 1 controlador migrado (`payment-settings`).
2. Migrar sidebar de plataforma: dividir `app-sidebar.tsx` en `sidebar-platform.tsx` / `sidebar-tenant.tsx`.
3. Crear ruta group `(platform)` con layout `data-platform` y mover `/settings/payment` → `/platform/settings/payment`.
4. Ampliar `proxy.ts` con guard por rol de rutas (`/platform/*` vs tenant).
5. `npm run lint` + `npm run build` en frontend; `npm run lint` backend.

### Fase 1 — Modelo de datos
1. Esquema Prisma: enums `DistributorType/DistributorStatus/SaleChannel`, modelos `Distributor`, `DistributorBalance`, `DistributorDelivery`; columnas `InventoryMovement.distributorId`, `Sale.distributorId/channel`; `MembershipRole.DISTRIBUTOR`; tablas `PlatformSetting`, `PlatformAuditLog`.
2. Migración (`npm run prisma:migrate`) sin pérdida de datos.
3. Seed: cuenta SUPER_ADMIN platform-admin, ejemplo de distribuidor por empresa demo.
4. Actualizar `permissions.constant.ts` + `frontend/types/permissions.ts`.

### Fase 2 — Backend plataforma
1. Módulo `platform` completo (companies, plans, settings, metrics, audit, admins).
2. Reubucar endpoints globales bajo `/platform`; mantener alias deprecado.
3. Tests: `PlatformGuard` niega tenant-context; `TenantGuard` no ve `/platform`.

### Fase 3 — Backend distribuidores
1. Módulo `distributors` (CRUD + transfers/returns + ventas + liquidación).
2. Integración de inventario con `$transaction` y Kardex (`TRANSFER/RETURN/SALE`).
3. Permisos `distributor:*` y `@Roles`/`@Permissions` en controladores.

### Fase 4 — Frontend
1. `(platform)`: páginas de plataforma + sidebar + guard.
2. Quitar de `(dashboard)` las páginas de plataforma y sus enlaces.
3. `(dashboard)/distributors`: lista, detalle, despachos, ventas, liquidación (cliente `distributors-client.tsx`, tokens de tema ya unificados).
4. Integrar "Canal: Distribuidor" en POS/ventas y filtros en reportes.

### Fase 5 — Endurecimiento
1. Tests e2e (Supertest) por dominio: acceso cross-domain debe dar 403.
2. Auditoría de enforcement: toda página con su guard; sin `serverApiFetch` que oculte 403 sin feedback.
3. CI que compare permisos frontend vs backend.
4. Documentar flujos y actualizar `docs/informes/informe-sistema-permisos-rbac.md`.

---

## 8. Criterios de aceptación

- [ ] `GET /platform/**` responde 403 para cualquier usuario sin `globalRole` SUPER_ADMIN/SUPPORT_ADMIN, incluso con companyId.
- [ ] Ninguna página de `(platform)` es accesible desde el sidebar de tenant ni viceversa.
- [ ] `TenantGuard` no interviene en `/platform`; `PlatformGuard` no interviene en `/api/tenant`.
- [ ] El SUPER_ADMIN puede gestionar empresas/planes/pagos globales **sin** que aparezcan secciones de empresa (productos/ventas) en su UI.
- [ ] Un `COMPANY_ADMIN` no puede abrir ninguna ruta `/platform`.
- [ ] Un distribuidor existe en cada empresa, recibe mercadería (`TRANSFER`), reporta ventas y genera Kardex; el stock global es consistente (`$transaction`).
- [ ] `npm run lint` y `npm run build` limpios en frontend y backend; migración aplicada sin pérdida.
- [ ] Permisos frontend ↔ backend sin drift (verificado por test/CI).

---

## 9. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Romper rutas/productivos al mover páginas | Fase 0 primero; mantener aliases + `redirect()` temporal en las rutas viejas |
| Drift de permisos frontend/backend | Fuente única + test de CI (ya hay precedentes de drift) |
| Stock inconsistente con distribuidores | Solo `DistributorsModule → InventoryModule` con `$transaction`; nunca toques inversos |
| `TenantGuard`/`PlatformGuard` solapándose | Guards excluyentes; tests e2e de 403 cross-domain |
| Depreciar `GlobalRole.ADMIN` | Verificar 0 usos antes de eliminar; migración con `USING` si hace falta |

---

## 10. Fuera de alcance (por ahora)

- Multi-tenant por región / sharding.
- Reemplazo de JWT por sesiones.
- Listas de precios por distribuidor (dejado como `priceListId` opcional).
- Migración de `User` a una tabla `PlatformUser` separada (se deja registrada como opción futura si la mezcla vuelve a ser un problema).
