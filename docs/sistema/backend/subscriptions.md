# Módulo: Subscriptions (suscripción de empresa y solicitudes de cambio de plan)

## Propósito
Gestiona la suscripción de una empresa (`Subscription`) — consulta, cancelación, aprobación/rechazo de suscriptores y estadísticas — y las solicitudes de cambio de plan (`PlanUpgradeRequest`) con comprobante de pago, revisión por `SUPER_ADMIN` y activación del nuevo plan.

## Archivos clave
- `backend/src/modules/subscriptions/subscriptions.controller.ts` — endpoints de la suscripción de la empresa y administración de suscriptores.
- `backend/src/modules/subscriptions/subscriptions.service.ts` — lógica sobre `Subscription`/`Company`.
- `backend/src/modules/subscriptions/plan-upgrade-requests.controller.ts` — endpoints de solicitudes de upgrade de plan.
- `backend/src/modules/subscriptions/plan-upgrade-requests.service.ts` — lógica de solicitudes de upgrade.
- `backend/src/modules/subscriptions/dto/plan-upgrade.dto.ts` — `CreatePlanUpgradeRequestDto`, `SubmitUpgradeProofDto`, `ReviewPlanUpgradeDto`.
- `backend/src/modules/subscriptions/subscriptions.module.ts` — importa `PrismaModule`, `NotificationsModule`, `EmailModule`; exporta ambos servicios.

## Endpoints

### GET /api/subscriptions/current
- **Descripción**: Devuelve la suscripción más reciente de la empresa con su `plan` y los últimos 10 `payments`.
- **Auth**: JWT + `@Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta**: `Subscription` (con `plan` y `payments`) o `null` si no existe.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### POST /api/subscriptions/upgrade
- **Descripción**: Intenta cambiar de plan. En la implementación actual delega en `upgradePlan`, que lanza una excepción indicando usar el módulo de solicitudes.
- **Auth**: JWT + `@Roles('COMPANY_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: objeto sin DTO: `{ planCode: string; billingCycle?: 'MONTHLY' | 'YEARLY' }` (no validado por `class-validator`).
- **Respuesta**: no devuelve: siempre lanza.
- **Errores**: `404 Not Found` con mensaje `'Use plan-upgrade-requests module for upgrades'`.
- **Efectos secundarios**: ninguno (no llega a escribir).

### POST /api/subscriptions/cancel
- **Descripción**: Cancela la suscripción de la empresa (status `CANCELED`, `autoRenew=false`).
- **Auth**: JWT + `@Roles('COMPANY_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta**: la suscripción previa con `status: 'CANCELED'` y `autoRenew: false` aplicados.
- **Efectos secundarios**: escribe `subscriptions` (`status`, `autoRenew`); invalida cache `plan:caps:<companyId>`.
- **Errores**: `404 Not Found` (`'Subscription not found'`) si no existe o si el `updateMany` no afecta filas.

### GET /api/subscriptions/subscribers
- **Descripción**: Lista paginada de empresas con su suscripción/plan y último pago. La respuesta transforma cada fila en `{ id, name, email, status, createdAt, subscription }`.
- **Auth**: JWT + `@Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params**: ninguno.
- **Query**: `status?` (string), `planId?` (string), `page?` (number, def. 1), `limit?` (number, def. 20).
- **Body**: no aplica.
- **Respuesta**: `{ data: [...], total, page, limit, totalPages }`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### PATCH /api/subscriptions/subscribers/:id/approve
- **Descripción**: Aprueba una suscripción: la pone `ACTIVE` y activa la empresa.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params**: `id` (string) — ID de la suscripción.
- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta**: la `Subscription` actualizada.
- **Efectos secundarios**: transacción que actualiza `subscriptions.status='ACTIVE'` y `companies.status='ACTIVE'`; crea `Notification` (IN_APP, tipo `SUBSCRIPTION`) al `COMPANY_ADMIN`; invalida cache `plan:caps:<companyId>`.
- **Errores**: `404 Not Found` (`'Subscription not found.'`).

### PATCH /api/subscriptions/subscribers/:id/reject
- **Descripción**: Rechaza una suscripción poniéndola `CANCELED`.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params**: `id` (string).
- **Query**: ninguno.
- **Body**: no aplica (el servicio acepta `reason?`, pero el controlador no lo recibe).
- **Respuesta**: la `Subscription` actualizada.
- **Efectos secundarios**: escribe `subscriptions.status='CANCELED'`; invalida cache `plan:caps:<companyId>`. No notifica al administrador de la empresa.
- **Errores**: `404 Not Found` si no existe.

### GET /api/subscriptions/stats
- **Descripción**: Agrupa suscripciones por `status` con conteo.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta**: resultado de `groupBy(['status'], { _count: { status: true } })`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### GET /api/subscriptions/limits/:resource
- **Descripción**: Comprueba el límite del plan para un recurso (`users` o `products`).
- **Auth**: JWT + `@Roles('COMPANY_ADMIN', 'MANAGER')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)`.
- **Path params**: `resource` (`'users'` | `'products'`).
- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta**: `{ allowed, current, limit, planName? }`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### POST /api/subscriptions/upgrade-requests
- **Descripción**: Crea (o reutiliza) una solicitud de upgrade de plan para la empresa del usuario. Devuelve los datos del pago y la configuración de pago del proveedor.
- **Auth**: JWT (global; sin `@Roles`). Requiere `user.companyId`.
- **Plan**: ninguno.
- **Guards extra**: ninguno explícito (usa los globales `JwtAuthGuard` + `RolesGuard`).
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body (DTO `CreatePlanUpgradeRequestDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `newPlanCode` | string | sí | `@IsString @IsNotEmpty` | Código del nuevo plan |
| `paymentMethod` | `PaymentProvider` | sí | `@IsEnum(PaymentProvider)` | Debe ser offline (`YAPE`, `PLIN`, `TRANSFER`) |
| `billingCycle` | `'MONTHLY'` \| `'YEARLY'` | no | `@IsString @IsOptional` | Ciclo (def. `MONTHLY`) |
| `idempotencyKey` | string | no | `@MaxLength(100) @Matches(/^[A-Za-z0-9._-]+$/)` | Clave de idempotencia |

- **Respuesta** (`buildUpgradeResponse`): `{ requestId, status, currentPlan: { code, name }, newPlan: { code, name, priceMonthly, priceYearly }, paymentMethod, paymentSettings: { provider, qrImageBase64, accountNumber, accountName, instructions } | null }`.
- **Efectos secundarios**: escribe `plan_upgrade_requests` (status `PENDING`); si hay una solicitud `PENDING` previa de la empresa, la reutiliza sin crear otra. No notifica en este paso.
- **Errores**: `400 BadRequestException` (método no soportado; perfil incompleto para plan de pago), `404 NotFoundException` (empresa o plan no encontrado), `409 ConflictException` (`'Ya tienes ese plan activo'`, `'Método de pago no disponible'`).

### POST /api/subscriptions/upgrade-requests/:id/proof
- **Descripción**: Sube el comprobante de pago de una solicitud `PENDING` y la marca con `submittedAt`. Notifica a todos los `SUPER_ADMIN`.
- **Auth**: JWT. Requiere `user.companyId`.
- **Plan**: ninguno.
- **Guards extra**: ninguno explícito.
- **Path params**: `id` (`ParseUUIDPipe`) — ID de la solicitud.
- **Query**: ninguno.
- **Body (DTO `SubmitUpgradeProofDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `imageBase64` | string | sí | `@IsNotEmpty @MaxLength(2_000_000) @Matches(/^data:image\//)` | Imagen Base64 |
| `paymentDate` | string | no | `@IsOptional @IsString` | Fecha de pago (ISO) |

- **Respuesta**: `{ requestId, status: 'PENDING' }`.
- **Efectos secundarios**: escribe `plan_upgrade_requests` (`proofImageBase64`, `paymentDate`, `submittedAt`); crea `Notification` (IN_APP, tipo `PLAN_UPGRADED`) para cada usuario `SUPER_ADMIN` activo.
- **Errores**: `400` (formato de comprobante inválido), `404` (solicitud no encontrada), `409` (ya enviada o revisada).

### GET /api/subscriptions/upgrade-requests/my
- **Descripción**: Lista todas las solicitudes de upgrade de la empresa del usuario (desc).
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: ninguno explícito.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de `PlanUpgradeRequest` con `plan`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito (si no hay `companyId`, se usa `''`).

### GET /api/subscriptions/upgrade-requests/my/pending
- **Descripción**: Devuelve la solicitud `PENDING` más reciente de la empresa del usuario.
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: ninguno explícito.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: `PlanUpgradeRequest` con `plan` o `null`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### GET /api/subscriptions/upgrade-requests/pending
- **Descripción**: Lista todas las solicitudes `PENDING` (asc) con empresa y plan.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: ninguno explícito.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de `PlanUpgradeRequest` con `company` (`id`, `name`, `email`) y `plan`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### POST /api/subscriptions/upgrade-requests/:id/review
- **Descripción**: Revisa una solicitud `PENDING`. Si se aprueba, cambia el plan de la suscripción, activa la empresa y registra un pago. Si se rechaza, únicamente marca la solicitud.
- **Auth**: JWT + `@Roles('SUPER_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: ninguno explícito.
- **Path params**: `id` (`ParseUUIDPipe`).
- **Query**: ninguno.
- **Body (DTO `ReviewPlanUpgradeDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `status` | `'APPROVED'` \| `'REJECTED'` | sí | `@IsString @IsNotEmpty` | Resultado de la revisión |
| `reviewNotes` | string | no | `@IsOptional @IsString` | Notas de revisión |

- **Respuesta**: `{ requestId, status }`.
- **Efectos secundarios**:
  - Rechazo: escribe `plan_upgrade_requests` (`REJECTED`, `reviewedBy`, `reviewedAt`, `reviewNotes`); envía email `sendSubscriptionRejected`.
  - Aprobación: transacción que marca `APPROVED`, valida perfil (si el plan no es `FREE`), actualiza `subscriptions` (nuevo `planId`, `billingCycle`, `startDate`, `endDate`, `status=ACTIVE`, `provider`), actualiza `companies.status='ACTIVE'` y crea `Payment` (`transactionId = upgrade-<id>`, `SUCCEEDED`); invalida cache `plan:caps:<companyId>`; crea `Notification` (IN_APP, `SUBSCRIPTION_APPROVED`) y envía email `sendSubscriptionApproved` al `COMPANY_ADMIN`.
- **Errores**: `400` (perfil incompleto al aprobar plan de pago), `404` (solicitud o suscripción no encontrada), `409` (la solicitud no está pendiente).

## Funciones del servicio (`SubscriptionsService`)

### `findByCompany(companyId)`
- **Qué hace**: busca la suscripción más reciente con `plan` y sus 10 pagos más recientes.
- **Escribe en**: no escribe.
- **Devuelve**: `Subscription` con `plan` y `payments` o `null`.
- **Lanza**: nada explícito.

### `findAllSubscribers(filters?)`
- **Qué hace**: cuenta y lista suscripciones paginadas filtrando por `status`/`planId`; transforma la salida a un objeto por empresa.
- **Escribe en**: no escribe.
- **Devuelve**: `{ data, total, page, limit, totalPages }`.
- **Lanza**: nada explícito.

### `approveSubscriber(subscriptionId)`
- **Qué hace**: marca la suscripción `ACTIVE`, activa la empresa y notifica al `COMPANY_ADMIN`.
- **Escribe en**: `subscriptions`, `companies`, `notifications`; invalida cache `plan:caps:<companyId>`.
- **Devuelve**: la suscripción actualizada.
- **Lanza**: `NotFoundException('Subscription not found.')`.

### `rejectSubscriber(subscriptionId, reason?)`
- **Qué hace**: marca la suscripción `CANCELED` dentro de una transacción.
- **Escribe en**: `subscriptions`; invalida cache `plan:caps:<companyId>`.
- **Devuelve**: la suscripción cancelada.
- **Lanza**: `NotFoundException('Subscription not found.')`.
- **Nota**: `reason` no se usa.

### `getStats()`
- **Qué hace**: `subscription.groupBy(['status'], { _count: { status: true } })`.
- **Escribe en**: no escribe.
- **Devuelve**: conteo por estado.
- **Lanza**: nada explícito.

### `processExpiredTrials()`
- **Qué hace**: busca suscripciones `TRIALING` vencidas, las pasa a `EXPIRED`, marca la empresa `INACTIVE` y notifica.
- **Escribe en**: `subscriptions`, `companies`, `notifications`; invalida cache `plan:caps:<companyId>`.
- **Devuelve**: `{ processed: number }`.
- **Lanza**: nada explícito.
- **Nota**: no está referenciado por ningún endpoint del controlador; tampoco es un `@Cron` (la lógica de cron equivalente vive en `BillingService`).

### `checkLimit(companyId, resource)` (privada por uso interno)
- **Qué hace**: busca la suscripción `ACTIVE`; para `users` cuenta memberships y para `products` cuenta productos; compara con `plan.maxUsers`/`plan.maxProducts`.
- **Escribe en**: no escribe.
- **Devuelve**: `{ allowed, current, limit, planName? }`. Sin suscripción o recurso no soportado: `{ allowed: true, current: 0, limit: null }`.
- **Lanza**: nada explícito.

### `upgradePlan(companyId, planCode, billingCycle?)`
- **Qué hace**: no implementado; siempre lanza para redirigir al módulo de solicitudes.
- **Escribe en**: no escribe.
- **Devuelve**: nada.
- **Lanza**: `NotFoundException('Use plan-upgrade-requests module for upgrades')`.

### `cancelSubscription(companyId)`
- **Qué hace**: busca la suscripción y la actualiza a `CANCELED` con `autoRenew=false`.
- **Escribe en**: `subscriptions`; invalida cache `plan:caps:<companyId>`.
- **Devuelve**: la suscripción previa con `status`/`autoRenew` modificados.
- **Lanza**: `NotFoundException('Subscription not found')` si no existe o si no se afecta ninguna fila.

### `checkPlanLimits(companyId, resource)`
- **Qué hace**: delega en `checkLimit`.
- **Escribe en**: no escribe.
- **Devuelve**: resultado de `checkLimit`.
- **Lanza**: nada explícito.

## Funciones del servicio (`PlanUpgradeRequestsService`)

### `createRequest(companyId, input)`
- **Qué hace**: valida proveedor offline, empresa, suscripción y plan; verifica perfil completo para planes de pago; obtiene `PaymentSetting` habilitado; reutiliza solicitud `PENDING` previa o crea una nueva con soporte de idempotencia (`P2002`).
- **Escribe en**: `plan_upgrade_requests`.
- **Devuelve**: respuesta construida por `buildUpgradeResponse`.
- **Lanza**: `BadRequestException`, `NotFoundException`, `ConflictException` (ver endpoint).

### `submitProof(requestId, companyId, input)`
- **Qué hace**: valida formato de imagen, busca la solicitud `PENDING` de la empresa, guarda el comprobante y notifica a los `SUPER_ADMIN`.
- **Escribe en**: `plan_upgrade_requests`, `notifications`.
- **Devuelve**: `{ requestId, status: 'PENDING' }`.
- **Lanza**: `BadRequestException`, `NotFoundException`, `ConflictException`.

### `getPending()`
- **Qué hace**: lista solicitudes `PENDING` con empresa y plan.
- **Escribe en**: no escribe.
- **Devuelve**: array.
- **Lanza**: nada explícito.

### `getByCompany(companyId)`
- **Qué hace**: lista solicitudes de la empresa (desc) con `plan`.
- **Escribe en**: no escribe.
- **Devuelve**: array.
- **Lanza**: nada explícito.

### `getPendingRequest(companyId)`
- **Qué hace**: devuelve la solicitud `PENDING` más reciente de la empresa.
- **Escribe en**: no escribe.
- **Devuelve**: `PlanUpgradeRequest` con `plan` o `null`.
- **Lanza**: nada explícito.

### `review(requestId, reviewerId, input)`
- **Qué hace**: si `REJECTED`, marca y envía email; si aprueba, valida perfil, transiciona la suscripción, registra pago, activa empresa, invalida cache y notifica/envía email.
- **Escribe en**: `plan_upgrade_requests`, `subscriptions`, `companies`, `payments`, `notifications`; invalida cache `plan:caps:<companyId>`.
- **Devuelve**: `{ requestId, status }`.
- **Lanza**: `BadRequestException`, `NotFoundException`, `ConflictException`.

### `buildUpgradeResponse(...)` / `createOrReuse(...)` (privadas)
- **Qué hace**: `buildUpgradeResponse` arma la respuesta del upgrade; `createOrReuse` captura `P2002` y devuelve la solicitud existente por `idempotencyKey` + `companyId`.
- **Escribe en**: no escribe directamente.
- **Devuelve**: objeto de respuesta o `{ request, existingSettings }`.
- **Lanza**: re-lanza errores distintos de `P2002`.
