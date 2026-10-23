# Módulo: Billing (facturación recurrente y ciclo de cobro)

## Propósito
Ejecuta el ciclo de facturación programado (cron diario) que genera pagos pendientes, marca suscripciones vencidas como `PAST_DUE`, suspende cuentas morosas, expira pruebas y envía recordatorios; además expone el estado de facturación de una empresa.

## Archivos clave
- `backend/src/modules/billing/billing.controller.ts` — endpoint `billing/status`.
- `backend/src/modules/billing/billing.service.ts` — lógica del cron y del estado de facturación.
- `backend/src/modules/billing/billing.module.ts` — importa `PrismaModule`, `NotificationsModule`, `EmailModule`; exporta `BillingService`.

## Endpoints

### GET /api/billing/status
- **Descripción**: Devuelve el estado de facturación de la empresa: suscripción, pago pendiente actual, último pago exitoso y pagos recientes.
- **Auth**: JWT + `@Roles('COMPANY_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta**:
  ```
  {
    subscription: { id, status, plan, startDate, endDate, autoRenew, billingCycle },
    currentPending: { id, amount, dueDate, status } | null,
    lastPayment: { id, amount, paidAt, status } | null,
    recentPayments: [{ id, amount, status, paidAt, createdAt }]
  }
  ```
  o `null` si la empresa no tiene suscripción.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

## Cron / tareas programadas

### `processBillingCycle()` (`@Cron(CronExpression.EVERY_DAY_AT_6AM)`)
- **Descripción**: Orquesta el ciclo de facturación diario (6:00 AM) ejecutando, en orden, las cinco tareas internas y devolviendo un resumen.
- **Devuelve**: `{ pendingPaymentsCreated, markedPastDue, suspended, expiredTrials, trialRemindersSent }`.
- **Efectos secundarios**: ver cada tarea; además registra logs con `Logger`.

## Funciones del servicio (`BillingService`)

### `processBillingCycle()`
- **Qué hace**: llama en secuencia a `createPendingPayments`, `markPastDue`, `suspendOverdue`, `processExpiredTrials` y `notifyExpiringTrials`.
- **Escribe en**: efecto agregado de las tareas.
- **Devuelve**: objeto de conteos.
- **Lanza**: no captura errores propios.

### `createPendingPayments()` (privada)
- **Qué hace**: para suscripciones `ACTIVE` con `autoRenew` y `endDate` entre hoy y +3 días sin pago `PENDING`, crea un `Payment` `PENDING` y notifica/envía email al `COMPANY_ADMIN`.
- **Escribe en**: `payments`; `notifications`; email `payment-received` (asunto "Tu suscripción vence en N día(s)").
- **Devuelve**: número de pagos creados.
- **Lanza**: nada explícito.

### `markPastDue()` (privada)
- **Qué hace**: para suscripciones `ACTIVE` con `endDate < hoy`, pasa suscripción y empresa a `PAST_DUE` (transacción) y notifica al `COMPANY_ADMIN`.
- **Escribe en**: `subscriptions`, `companies`, `notifications`.
- **Devuelve**: número de suscripciones marcadas.
- **Lanza**: nada explícito.

### `suspendOverdue()` (privada)
- **Qué hace**: para suscripciones `PAST_DUE` con `endDate` anterior a hace 5 días, marca la empresa como `SUSPENDED` y notifica al `COMPANY_ADMIN`. No modifica el estado de la suscripción.
- **Escribe en**: `companies`, `notifications`.
- **Devuelve**: número de cuentas suspendidas.
- **Lanza**: nada explícito.

### `processExpiredTrials()` (privada)
- **Qué hace**: para suscripciones `TRIALING` vencidas, las pasa a `EXPIRED`, marca la empresa `INACTIVE`, notifica al `COMPANY_ADMIN` y envía email `welcome`.
- **Escribe en**: `subscriptions`, `companies`, `notifications`; email.
- **Devuelve**: número de pruebas expiradas.
- **Lanza**: nada explícito.

### `notifyExpiringTrials()` (privada)
- **Qué hace**: para suscripciones `TRIALING` que vencen en <= 3 días, notifica (`TRIAL_EXPIRING_SOON`) y envía email al `COMPANY_ADMIN` (mensaje especial si quedan <= 1 día).
- **Escribe en**: `notifications`; email `welcome`.
- **Devuelve**: número de recordatorios enviados.
- **Lanza**: nada explícito.

### `getBillingStatus(companyId)`
- **Qué hace**: busca la suscripción más reciente con `plan`, últimos 12 pagos y 12 comprobantes; calcula pendiente actual, último pago exitoso y 6 pagos recientes.
- **Escribe en**: no escribe.
- **Devuelve**: objeto de estado de facturación o `null`.
- **Lanza**: nada explícito.

## Observaciones
- El cron no aplica guards (es una tarea interna).
- Usa `@nestjs/schedule` (`Cron`, `CronExpression`).
- `processExpiredTrials` de este servicio duplica la lógica de `SubscriptionsService.processExpiredTrials()`; la que se ejecuta automáticamente es la de `BillingService`.
