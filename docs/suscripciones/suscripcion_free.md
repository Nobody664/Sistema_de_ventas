# Flujo del Plan Free (Demo / Trial)

## 1. Visión General

El plan Free es el punto de entrada al sistema. Se asigna automáticamente a toda nueva empresa registrada.
Duración: **7 días** de prueba. Sin costo. Sin necesidad de aprobación de SUPER_ADMIN.

## 2. Modelo de Datos

### Plan (seed)
| Campo | Valor |
|-------|-------|
| code | `FREE` |
| name | `Free` |
| priceMonthly | `0.00` |
| priceYearly | `0.00` |
| maxUsers | `1` |
| maxProducts | `50` |
| features | `["1 usuario", "50 productos", "1 sucursal", "POS básico"]` |

### Company.status
| Estado | Significado |
|--------|-------------|
| `TRIAL` | Empresa en período de prueba (7 días) |
| `ACTIVE` | Suscripción activa (pagada) |
| `PAST_DUE` | Pago vencido |
| `SUSPENDED` | Suspendida por impago |
| `INACTIVE` | Trial expirado / cuenta desactivada |

### Subscription.status
| Estado | Significado |
|--------|-------------|
| `TRIALING` | Período de prueba activo |
| `ACTIVE` | Suscripción pagada activa |
| `PAST_DUE` | Pago vencido |
| `CANCELED` | Cancelada por admin/usuario |
| `EXPIRED` | Trial expirado |

## 3. Flujo de Registro (Actual)

```
POST /auth/register
  → AuthService.register()
    1. Valida email duplicado
    2. Crea Company { status: TRIAL, trialEndsAt: now + 7 días }
    3. Busca Plan por planCode (default: 'FREE')
    4. Crea Subscription { status: TRIALING, endDate: now + 7 días, planId: plan.id }
    5. Crea User + Membership { role: COMPANY_ADMIN }
    6. Retorna JWT + session { user: { ..., planCode: 'FREE', subscriptionStatus: 'TRIALING' } }
```

### Frontend
- `SignUpForm` envía POST al backend vía API route `/api/auth/register`
- No envía `planCode` explícitamente → backend usa `'FREE'` por defecto
- Al éxito: almacena tokens, redirige a `/dashboard`

## 4. Ciclo de Vida del Free

### Día 1-7: TRIALING
- Company.status = `TRIAL`
- Subscription.status = `TRIALING`
- Acceso completo al sistema (con límites del plan FREE)
- Sin notificaciones de expiración (GAP actual)

### Día 7: Expiración (cron diario 6 AM)
```
BillingService.processExpiredTrials()
  → Subscription.findMany({ where: { status: TRIALING, endDate: { lt: now } } })
  → Actualiza cada una:
    - subscription.status = 'EXPIRED'
    - company.status = 'INACTIVE'
  → Envía notificación in-app + email al admin
```

### Post-expiración
- Company.status = `INACTIVE`
- Subscription.status = `EXPIRED`
- Sin acceso al sistema (debería bloquearse - GAP actual)

## 5. Gaps Identificados

### Gap 1: TenantGuard solo bloquea SUSPENDED
**Archivo**: `src/common/guards/tenant.guard.ts:46`
```typescript
// Solo bloquea SUSPENDED
if (companyStatus === 'SUSPENDED') {
  throw new UnauthorizedException('Company is suspended');
}
// TRIAL, INACTIVE, PAST_DUE pasan sin problema
```

**Impacto**: Empresas con trial expirado (INACTIVE) pueden seguir usando el sistema.

### Gap 2: SubscriptionLimitGuard definido pero NUNCA usado
**Archivo**: `src/common/guards/subscription-limit.guard.ts`
- Guard completo con lógica de límites
- **Zero usos** en controllers
- El servicio interno devuelve límites restrictivos si subscription no es ACTIVE, pero nunca se ejecuta

**Impacto**: Los límites del plan FREE (1 usuario, 50 productos) no se aplican.

### Gap 3: Frontend companies page lee `company.subscription` pero backend retorna `subscriptions[]`
**Archivo**: `frontend/app/(dashboard)/companies/page.tsx:118`
```tsx
// Código actual (SIN PLAN - siempre "-")
company.subscription?.plan?.name ?? '-'

// Backend retorna:
{ subscriptions: [{ plan: { name: 'Free' } }] }
//          ^^^ plural, no singular
```

**Impacto**: El nombre del plan siempre se muestra como "-" en el panel de super admin.

### Gap 4: Sin middleware frontend
No existe `middleware.ts` en el frontend.

**Impacto**: No hay redirección proactiva por company status.

### Gap 5: Dashboard layout sin verificación de company status
**Archivo**: `frontend/app/(dashboard)/layout.tsx`
```tsx
// Solo verifica si existe session.user
if (!session?.user) redirect('/sign-in');
// No verifica companyStatus, subscriptionStatus, trial expirado
```

**Impacto**: Usuarios con empresa INACTIVE/SUSPENDED ven el dashboard.

### Gap 6: Sin notificación pre-expiración de trial
El cron `processExpiredTrials()` solo notifica el día de la expiración (cuando ya expiró).
No hay aviso 3 días antes ni 1 día antes como existe para pagos (createPendingPayments).

### Gap 7: CompaniesService.create() sin subscription
Cuando un SUPER_ADMIN crea empresa via `POST /companies` (sin plan), no se crea subscription.
La empresa queda huérfana sin plan asociado.

### Gap 8: No hay banner/warning de trial próximo a expirar en frontend
El company admin no ve ninguna advertencia visual sobre el trial.

## 6. Relaciones Clave

```
Company (1) ──── (1) Subscription ──── (1) Plan
  │                                        │
  └── status: TRIAL/ACTIVE/PAST_DUE/...    └── code: FREE/START/GROWTH/SCALE
  └── trialEndsAt                           └── maxUsers, maxProducts
```

## 7. Archivos Afectados

### Backend
| Archivo | Rol |
|---------|-----|
| `src/modules/auth/auth.service.ts` | Registro + creación company/subscription |
| `src/modules/companies/companies.service.ts` | CRUD empresas |
| `src/modules/companies/companies.controller.ts` | Endpoints companies |
| `src/modules/subscriptions/subscriptions.service.ts` | Límites, expiración |
| `src/common/guards/tenant.guard.ts` | Bloqueo por status |
| `src/common/guards/subscription-limit.guard.ts` | Límites de plan (sin usar) |
| `src/modules/billing/billing.service.ts` | Cron de expiración |
| `src/modules/notifications/notifications.service.ts` | Notificaciones |
| `src/modules/email/email.service.ts` | Emails |

### Frontend
| Archivo | Rol |
|---------|-----|
| `app/(dashboard)/companies/page.tsx` | Listado empresas (plan name roto) |
| `app/(dashboard)/layout.tsx` | Layout sin verificación de status |
| `components/auth/sign-up-form.tsx` | Formulario registro |
| `components/layout/app-header.tsx` | Header (sin banner de trial) |
