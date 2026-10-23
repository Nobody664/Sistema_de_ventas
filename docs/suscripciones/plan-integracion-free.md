# Plan de Implementación: Flujo Plan Free

## Objetivo

Corregir y completar el flujo del plan Free (Demo) para que:
- El plan FREE se asigne y persista correctamente en todo el sistema
- Los límites del plan FREE se respeten (1 usuario, 50 productos, etc.)
- Las empresas con trial expirado pierdan acceso al sistema
- Los usuarios reciban notificaciones antes y después de la expiración
- El panel de super admin muestre correctamente el plan de cada empresa
- La transición Free → plan pago sea clara y funcional

---

## Fase 1: Correcciones Críticas (Backend)

### 1.1 Fix: Companies list retorna subscriptions[] no subscription

**Archivo**: `backend/src/modules/companies/companies.service.ts`

```typescript
// Actual (findAll, findCurrent)
include: {
  subscriptions: { include: { plan: true }, take: 1 },  // plural
}

// Fix: renombrar en controller o transformar response
// Opción A: Agregar alias virtual 'subscription' en el controller
// Opción B: Usar Prisma $transform para renombrar
// Opción C: Agregar computed field con map
```

**Tareas**:
- [ ] Modificar `companies.service.ts` para que retorne `subscription` (singular) en lugar de `subscriptions[]`
- [ ] O usar un DTO/mapper que transforme `subscriptions[0]` a `subscription`

### 1.2 Fix: CompaniesService.create() sin subscription

**Archivo**: `backend/src/modules/companies/companies.service.ts`

```typescript
// Actual: crea company sin subscription
async create(data) {
  return this.prisma.company.create({ data: { ...data, status: 'TRIAL' } });
}

// Fix: crear también subscription FREE al crear company
async create(data, userId?: string) {
  const plan = await this.prisma.plan.findUnique({ where: { code: 'FREE' } });
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return this.prisma.company.create({
    data: {
      ...data,
      status: 'TRIAL',
      trialEndsAt,
      subscriptions: {
        create: {
          planId: plan.id,
          status: 'TRIALING',
          startDate: new Date(),
          endDate: trialEndsAt,
        },
      },
    },
  });
}
```

**Tareas**:
- [ ] Añadir creación de subscription FREE en `create()` de CompaniesService
- [ ] Validar que el plan FREE exista antes de crear

### 1.3 Fix: TenantGuard bloquea INACTIVE y PAST_DUE

**Archivo**: `backend/src/common/guards/tenant.guard.ts`

```typescript
// Actual: solo bloquea SUSPENDED
if (companyStatus === 'SUSPENDED') throw new UnauthorizedException('Company is suspended');

// Fix: bloquear también INACTIVE y PAST_DUE
const BLOCKED_STATUSES: CompanyStatus[] = ['SUSPENDED', 'INACTIVE', 'PAST_DUE'];
if (BLOCKED_STATUSES.includes(companyStatus as CompanyStatus)) {
  const messages = {
    SUSPENDED: 'Company is suspended',
    INACTIVE: 'Your trial has expired. Please purchase a plan to continue.',
    PAST_DUE: 'Your subscription is past due. Please make a payment.',
  };
  throw new UnauthorizedException(messages[companyStatus]);
}
```

**Consideración**: PAST_DUE podría permitir acceso limitado (solo ver pagos). Pero para fase 1, bloqueamos todos.

**Tareas**:
- [ ] Agregar `INACTIVE` y `PAST_DUE` a los status bloqueados en TenantGuard
- [ ] Agregar mensajes personalizados por status

### 1.4 Fix: SubscriptionLimitGuard activo en controllers

**Archivo**: `backend/src/modules/products/products.controller.ts`
**Archivo**: `backend/src/modules/employees/employees.controller.ts`
**Archivo**: `backend/src/modules/customers/customers.controller.ts`
**Archivo**: `backend/src/modules/categories/categories.controller.ts`

```typescript
// Agregar guard en endpoints de creación
@Post()
@UseGuards(SubscriptionLimitGuard)
@LimitResource('products') // o 'users', 'customers', etc.
async create(@Body() dto: CreateProductDto) { ... }
```

**Tareas**:
- [ ] Agregar `@UseGuards(SubscriptionLimitGuard)` + `@LimitResource()` en:
  - `ProductsController.create` → `products`
  - `EmployeesController.create` → `users`
  - `CustomersController.create` → `customers`
  - `CategoriesController.create` → No definido en SubscriptionLimitService — evaluar
- [ ] Verificar que el error `LIMIT_EXCEEDED` se maneje correctamente en frontend (ya existe catch en `lib/api.ts`)
- [ ] El SubscriptionLimitService ya retorna límites restrictivos para TRIALING (maxUsers: 1, maxProducts: 10, etc.)

---

## Fase 2: Notificaciones de Trial

### 2.1 Nueva notificación: trial próximo a expirar

**Archivo**: `backend/src/modules/billing/billing.service.ts`

Agregar nuevo cron que ejecute **1 vez al día** (mismo schedule, step adicional):

```typescript
async notifyExpiringTrials() {
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const trials = await this.prisma.subscription.findMany({
    where: {
      status: 'TRIALING',
      endDate: { gte: new Date(), lte: threeDaysFromNow },
    },
    include: { company: { include: { memberships: { include: { user: true } } } } },
  });

  for (const sub of trials) {
    const daysLeft = Math.ceil((sub.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    await this.notificationsService.create({
      companyId: sub.companyId,
      type: 'TRIAL_EXPIRING_SOON',
      title: `Tu prueba gratis termina en ${daysLeft} día(s)`,
      message: `Suscríbete a un plan para no perder el acceso a tu cuenta.`,
      userId: sub.company.memberships[0].userId,
    });
    // También enviar email si hay Redis conectado
  }
}
```

**Tareas**:
- [ ] Agregar método `notifyExpiringTrials()` en BillingService
- [ ] Llamarlo desde `processBillingCycle()`
- [ ] Verificar que el tipo `TRIAL_EXPIRING_SOON` exista en NotificationType (backend enum)

### 2.2 Notificación día de expiración (ya existe parcialmente)

**Archivo**: `backend/src/modules/billing/billing.service.ts` → `processExpiredTrials()`

Ya notifica cuando el trial expira. Verificar que el mensaje indique claramente que deben comprar un plan.

```typescript
// Mensaje actual: "Your trial period has expired. Purchase a plan to continue."
// OK para fase 1.
```

### 2.3 Añadir aviso 24h antes de expiración

Agregar un cron adicional o filtro en `notifyExpiringTrials()` para los que expiran en < 24h con mensaje más urgente.

```typescript
// Dentro de notifyExpiringTrials:
if (daysLeft <= 1) {
  // Mensaje urgente
} else {
  // Mensaje normal
}
```

---

## Fase 3: Frontend — Correcciones y UX

### 3.1 Fix: Companies page — leer subscriptions[0]

**Archivo**: `frontend/app/(dashboard)/companies/page.tsx`

```tsx
// Actual (no funciona):
company.subscription?.plan?.name ?? '-'

// Fix:
company.subscriptions?.[0]?.plan?.name ?? '-'
```

**Tareas**:
- [ ] Cambiar `company.subscription` a `company.subscriptions[0]` en la card de empresas
- [ ] Verificar types: `Company` type tiene ambos `subscription?` y `subscriptions?` en `generated.ts`

### 3.2 Dashboard layout: verificar company status

**Archivo**: `frontend/app/(dashboard)/layout.tsx`

```tsx
const session = await getServerSession();
if (!session?.user) redirect('/sign-in');

// Añadir verificación de company status
if (session.user.companyStatus === 'INACTIVE') {
  redirect('/plan-expired'); // o mostrar modal
}
if (session.user.companyStatus === 'SUSPENDED') {
  redirect('/account-suspended');
}
```

**Nota**: `companyStatus` está en el JWT payload pero puede que no esté en `session.user`. Verificar `getServerSession` y el endpoint `/auth/me` que retorna `companyStatus`.

**Tareas**:
- [ ] Asegurar que `getServerSession` retorne `companyStatus`
- [ ] Agregar verificación y redirect en dashboard layout

### 3.3 Banner de trial próximo a expirar

**Archivo**: `frontend/components/layout/app-header.tsx` (nuevo componente)

```tsx
// Componente TrialBanner
// Mostrar si: company.status === 'TRIAL' y subscription.status === 'TRIALING' y trialEndsAt < 3 días
function TrialBanner() {
  const { user } = useAuthStore();
  // No hay trialEndsAt en el store actual...
  // Opción: fetch /subscriptions/current al cargar
}
```

**Alternativa**: Agregar `trialEndsAt` al store de auth y session.

**Tareas**:
- [ ] Decidir enfoque: ¿nuevo endpoint o incluir en session?
- [ ] Crear `TrialBanner` componente con:
  - Fondo amarillo/ámbar si quedan <= 3 días
  - Rojo si quedan <= 1 día
  - Botón "Ver planes" que lleve a `/subscriptions`
- [ ] Insertar en `app-header.tsx` o layout

### 3.4 Página de plan expirado

**Archivo**: `frontend/app/plan-expired/page.tsx` (nuevo)

Pantalla informativa que:
- Indica que el trial expiró
- Muestra los planes disponibles
- Botón para contratar/upgrade
- Sin acceso al dashboard

**Tareas**:
- [ ] Crear página `/plan-expired`
- [ ] Usar layout público (sin sidebar)
- [ ] Llamar a `/api/plans/` para mostrar opciones

### 3.5 Middleware para protección de rutas

**Archivo**: `frontend/middleware.ts` (nuevo)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken')?.value;
  // Si hay token pero companyStatus es INACTIVE/SUSPENDED, redirigir
  // ...implementar con lectura de cookie JWT o llamada a /auth/me
}
```

**Tareas**:
- [ ] Crear middleware.ts
- [ ] Configurar matcher para rutas protegidas
- [ ] Verificar company status desde cookie JWT o llamada API

---

## Fase 4: Flujo Free → Plan Pago

### 4.1 Verificar flujo de upgrade desde FREE

**Archivo**: `backend/src/modules/subscriptions/plan-upgrade-requests.service.ts`

El flujo actual de upgrade (con comprobante de pago) debe funcionar desde FREE:

```
FREE (TRIALING) → Usuario solicita upgrade con YAPE/PLIN/TRANSFER
  → PlanUpgradeRequest creado (PENDING)
  → Usuario sube comprobante
  → SUPER_ADMIN revisa y aprueba
  → Subscription se actualiza al nuevo plan con status ACTIVE
  → Company pasa a ACTIVE
```

**Tareas**:
- [ ] Probar flujo completo FREE → START/GROWTH/SCALE con comprobante
- [ ] Verificar que al aprobar, company.status cambie a ACTIVE
- [ ] Verificar que subscription.status cambie a ACTIVE

### 4.2 Mostrar banner de upgrade en dashboard del company admin

Si company.status === 'TRIAL' → mostrar banner con:
- "Estás usando el plan Free"
- Días restantes
- Botón "Mejorar plan" → `/subscriptions`

---

## Fase 5: Data Migration y Seed

### 5.1 Verificar seed de planes

**Archivo**: `backend/src/database/prisma/seed.js`

Confirmar que el plan FREE existe con los límites correctos:
- maxUsers: 1
- maxProducts: 50

**Tareas**:
- [ ] Verificar seed actual
- [ ] Si hace falta, ajustar límites del plan FREE

### 5.2 Migración para empresas existentes sin subscription

```sql
-- Empresas creadas via /companies (sin subscription)
INSERT INTO "Subscription" (id, "companyId", "planId", status, "startDate", "endDate", "billingCycle", provider, "autoRenew")
SELECT 
  gen_random_uuid()::text,
  c.id,
  (SELECT id FROM "Plan" WHERE code = 'FREE'),
  'TRIALING',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '7 days',
  'MONTHLY',
  'CASH',
  true
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Subscription" s WHERE s."companyId" = c.id
);
```

---

## Orden de Implementación

| Orden | Fase | Tarea | Dependencia |
|-------|------|-------|-------------|
| 1 | 1.1 | Fix companies list → subscriptions[0] | Ninguna |
| 2 | 1.2 | Fix create() sin subscription | Ninguna |
| 3 | 1.3 | TenantGuard bloquea INACTIVE/PAST_DUE | Ninguna |
| 4 | 1.4 | Activar SubscriptionLimitGuard en controllers | 3 (para que funcione) |
| 5 | 2.1-2.3 | Notificaciones de trial | Ninguna |
| 6 | 3.1 | Frontend companies page fix | 1 |
| 7 | 3.2 | Dashboard layout company status check | 3 |
| 8 | 3.3 | Trial banner en header | Sesión incluya trialEndsAt |
| 9 | 3.4 | Página plan expirado | 3, 7 |
| 10 | 3.5 | Middleware frontend | 3 |
| 11 | 4.1-4.2 | Flujo FREE → pago | 1, 2 |
| 12 | 5.2 | Migración empresas existentes | Todo lo anterior |

## Resumen de Archivos a Modificar/Crear

### Backend — Modificar
| Archivo | Cambio |
|---------|--------|
| `src/modules/companies/companies.service.ts` | Fix `create()` + alias subscription |
| `src/modules/companies/companies.controller.ts` | Mapear subscriptions[0] → subscription |
| `src/common/guards/tenant.guard.ts` | Bloquear INACTIVE + PAST_DUE |
| `src/modules/products/products.controller.ts` | Add @UseGuards(SubscriptionLimitGuard) |
| `src/modules/employees/employees.controller.ts` | Add @UseGuards(SubscriptionLimitGuard) |
| `src/modules/customers/customers.controller.ts` | Add @UseGuards(SubscriptionLimitGuard) |
| `src/modules/billing/billing.service.ts` | Add notifyExpiringTrials() |
| `src/modules/auth/auth.service.ts` | Incluir companyStatus + trialEndsAt en session |
| `src/modules/notifications/notifications.service.ts` | Verificar TRIAL_EXPIRING_SOON type |

### Frontend — Modificar
| Archivo | Cambio |
|---------|--------|
| `app/(dashboard)/companies/page.tsx` | Fix `subscriptions[0].plan.name` |
| `app/(dashboard)/layout.tsx` | Verificar company status |
| `components/layout/app-header.tsx` | Add TrialBanner |
| `lib/session.ts` / `stores/auth.store.ts` | Incluir trialEndsAt, companyStatus |

### Frontend — Crear
| Archivo | Propósito |
|---------|-----------|
| `app/plan-expired/page.tsx` | Página de trial expirado |
| `middleware.ts` | Protección de rutas por status |
| `components/layout/trial-banner.tsx` | Componente banner de trial |
