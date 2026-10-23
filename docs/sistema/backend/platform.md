# Módulo: platform (super-admin)

## Propósito

Área de administración de la plataforma (SaaS) para usuarios con `globalRole`
`SUPER_ADMIN` o `SUPPORT_ADMIN`. Agrupa la gestión de empresas (tenants), planes,
suscriptores, catálogo de planes, solicitudes de alta/upgrade (checkout y upgrade de
plan), revisión de comprobantes de pago, métricas globales, administradores de
plataforma y auditoría. Reutiliza servicios de otros módulos (`companies`, `plans`,
`subscriptions`, `payments`, `AuditService`, `PaymentSettingsService`).

Prefijo global: `/api` (`main.ts` → `app.setGlobalPrefix(apiPrefix)`, por defecto `api`).
Todas las rutas de este documento llevan el prefijo `/api`.

## Autorización de plataforma

- Todos los controllers se decoran con `@UseGuards(JwtAuthGuard, PlatformGuard, ...)`.
- `PlatformGuard` (`backend/src/common/guards/platform.guard.ts`) exige que el claim
  `roles` del usuario contenga `SUPER_ADMIN` o `SUPPORT_ADMIN`; si no, lanza
  `ForbiddenException('Se requieren permisos de plataforma.')` (403).
- Además, la mayoría de controladores usan `PermissionsGuard` con `@Permissions(...)`.
  `PermissionsGuard` (`backend/src/common/guards/permissions.guard.ts`) omite la
  comprobación si el usuario tiene `SUPER_ADMIN`; si no, agrega los permisos de sus
  roles vía `ROLE_PERMISSIONS`.
- Según `ROLE_PERMISSIONS` (`backend/src/common/constants/permissions.constant.ts`),
  `SUPPORT_ADMIN` solo posee `platform:view` y `platform:audit_view`. Por tanto los
  endpoints que exigen `platform:companies_manage`, `platform:plans_manage` o
  `platform:admins_manage` quedan efectivamente reservados a `SUPER_ADMIN`.
- `PLATFORM_MANAGE_SETTINGS` (`platform:settings_manage`) existe en el enum pero no se
  usa en ningún controller de este módulo (no verificado uso en el código).

## Archivos clave

Controllers:
- `backend/src/modules/platform/platform.controller.ts` — contexto de plataforma, configuración de pagos y revisión de comprobantes.
- `backend/src/modules/platform/platform-admins.controller.ts` — administradores de plataforma (listar, candidatos, otorgar/revocar).
- `backend/src/modules/platform/platform-audit.controller.ts` — auditoría global.
- `backend/src/modules/platform/platform-checkout-requests.controller.ts` — solicitudes de checkout (alta/upgrade) pendientes y revisión.
- `backend/src/modules/platform/platform-companies.controller.ts` — empresas (listar, crear, aprobar, rechazar, actualizar, estado).
- `backend/src/modules/platform/platform-metrics.controller.ts` — métricas globales.
- `backend/src/modules/platform/platform-plans.controller.ts` — catálogo de planes (CRUD).
- `backend/src/modules/platform/platform-subscriptions.controller.ts` — suscriptores (listar, stats, aprobar, rechazar).
- `backend/src/modules/platform/platform-upgrade-requests.controller.ts` — solicitudes de upgrade de plan pendientes y revisión.

Services propios:
- `backend/src/modules/platform/platform-admins.service.ts` — lógica de `PlatformAdminsService`.
- `backend/src/modules/platform/platform-metrics.service.ts` — lógica de `PlatformMetricsService`.

Módulo:
- `backend/src/modules/platform/platform.module.ts` — importa `PrismaModule`, `PaymentsModule`,
  `CompaniesModule`, `PlansModule`, `SubscriptionsModule`; registra los 9 controllers y los
  providers `PlatformMetricsService` y `PlatformAdminsService`.

Servicios/DTOs reutilizados por los controllers (definidos fuera del módulo):
- `@/modules/payments/payment-settings.service.ts`, `.../dto/payment-settings.dto.ts`
- `@/modules/payments/checkout-requests.service.ts`, `.../dto/checkout-requests.dto.ts`
- `@/modules/companies/companies.service.ts`, `.../dto/company.dto.ts`
- `@/modules/plans/plans.service.ts`, `.../dto/plan.dto.ts`
- `@/modules/subscriptions/subscriptions.service.ts`
- `@/modules/subscriptions/plan-upgrade-requests.service.ts`, `.../dto/plan-upgrade.dto.ts`
- `@/common/services/audit.service.ts`

---

## Endpoints

### Plataforma / contexto y pagos (controller `PlatformController`, base `platform`)

Este controller usa `@UseGuards(JwtAuthGuard, PlatformGuard)` **sin** `@Permissions`,
por lo que cualquier admin de plataforma (`SUPER_ADMIN` o `SUPPORT_ADMIN`) accede.

#### `GET /api/platform/context`

- **Descripción**: Devuelve contexto del área de plataforma del usuario autenticado.
- **Auth**: JWT + `@UseGuards(PlatformGuard)`.
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Query/params/body**: sin entradas.
- **Respuesta**: `{ platform: true, globalRole: <'SUPER_ADMIN'|'SUPPORT_ADMIN'|undefined>, roles: string[] }`.
  `globalRole` es el primer rol en `user.roles` que sea de plataforma.
- **Efectos secundarios**: ninguno.
- **Errores**: 403 `Se requieren permisos de plataforma.` si no es admin de plataforma.

#### `GET /api/platform/settings/payment`

- **Descripción**: Lista la configuración de todas las pasarelas de pago.
- **Auth**: JWT + `@UseGuards(PlatformGuard)`.
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Query/params/body**: sin entradas.
- **Respuesta**: `PaymentSettingsResponseDto[]` (todos los registros de `payment_settings`
  ordenados por `provider` asc).
- **Efectos secundarios**: ninguno (lectura).
- **Errores**: 403 de plataforma.

#### `PATCH /api/platform/settings/payment/:provider`

- **Descripción**: Crea o actualiza la configuración de una pasarela.
- **Auth**: JWT + `@UseGuards(PlatformGuard)`.
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `provider` | `PaymentProvider` | sí | `ParseEnumPipe(PaymentProvider)` | Ej. `YAPE`, `PLIN`, `TRANSFER`, `STRIPE`, `MERCADOPAGO`, `PAYPAL`, `CASH`, `CARD` |

- **Body (DTO `UpdatePaymentSettingsDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `isEnabled` | boolean | no | `@IsBoolean` | Habilita/deshabilita la pasarela |
  | `qrImageBase64` | string | no | `@IsString`, `@MaxLength(500000)`, `@Matches(/data:image\/(png\|jpe?g\|webp);base64,/)` | Imagen QR: data URL PNG/JPEG/WebP saneada con `sharp` (límite 500KB) |
  | `accountNumber` | string | no | `@IsString`, `@MaxLength(50)` | Número de cuenta |
  | `accountName` | string | no | `@IsString`, `@MaxLength(100)` | Titular |
  | `instructions` | string | no | `@IsString`, `@MaxLength(1000)` | Instrucciones de pago |
  | `config` | objeto | no | `@IsObject` | Configuración arbitraria de la pasarela |

- **Respuesta**: `PaymentSettingsResponseDto` (upsert por `provider`).
- **Efectos secundarios**: escritura en `payment_settings` (update si existe, create si no).
  No escribe `platform_audit_logs`.
- **Errores**: 403 de plataforma; 400 por validación del body o `provider` inválido.

#### `GET /api/platform/settings/payment/proofs/pending`

- **Descripción**: Lista los comprobantes de pago (`payment_proofs`) en estado `PENDING`.
- **Auth**: JWT + `@UseGuards(PlatformGuard)`.
- **Plan / Guards extra**: ninguno.
- **Query/params/body**: sin entradas.
- **Respuesta**: `PaymentProofResponseDto[]` ordenados por `createdAt` asc.
- **Efectos secundarios**: ninguno (lectura).
- **Errores**: 403 de plataforma.

#### `PATCH /api/platform/settings/payment/proofs/:proofId/review`

- **Descripción**: Revisa (aprueba o rechaza) un comprobante de pago.
- **Auth**: JWT + `@UseGuards(PlatformGuard)`.
- **Plan / Guards extra**: ninguno.
- **Path params**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `proofId` | string | sí | — | ID del comprobante |

- **Query params**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `userId` | string | sí (en la práctica) | — | ID del revisor; se pasa como `reviewerId`. No se toma de `@CurrentUser()` |

- **Body (DTO `ReviewPaymentProofDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `status` | `'APPROVED'` \| `'REJECTED'` | sí | `@IsEnum(['APPROVED','REJECTED'])` | Resultado de la revisión |
  | `notes` | string | no | `@IsString` | Notas de revisión |

- **Respuesta**: `PaymentProofResponseDto` con el nuevo `status`, `reviewedBy`, `reviewedAt`, `notes`.
- **Efectos secundarios** (según `PaymentSettingsService.reviewProof`):
  - Actualiza el comprobante (`updateMany` sólo si seguía `PENDING`; si ya fue revisado → 409).
  - Si `status === 'APPROVED'`: en una transacción marca el `Payment` pendiente más reciente
    de la suscripción como `SUCCEEDED` + `paidAt`; pone la `Subscription` en `ACTIVE` y extiende
    `endDate` +1 mes (o +12 si `billingCycle === 'YEARLY'`); pone la `Company` en `ACTIVE`.
  - No escribe `platform_audit_logs`; no envía emails ni notificaciones en este servicio.
- **Errores**: 404 `Comprobante no encontrado`; 409 `El comprobante ya fue revisado`; 403 de plataforma.

---

### Empresas (controller `PlatformCompaniesController`, base `platform/companies`)

`@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)`.

#### `GET /api/platform/companies`

- **Descripción**: Lista empresas con paginación.
- **Auth**: JWT + `@UseGuards(PlatformGuard, PermissionsGuard)` + `@Permissions([platform:view])`.
- **Plan / Guards extra**: ninguno.
- **Query params**: `page` (number, opcional, def. 1), `limit` (number, opcional, def. 20).
  Nota: llegan como string y se pasan sin transformar (`@Query('page') page?: number`).
- **Respuesta**: `{ data: Company[], total, page, limit, totalPages }`. Cada empresa incluye
  `subscriptions` (con `plan`, `take: 1`) y `_count` de `memberships` y `customers`.
- **Efectos secundarios**: ninguno (lectura).
- **Errores**: 403 de plataforma o de permisos.

#### `GET /api/platform/companies/:id`

- **Descripción**: Detalle de una empresa.
- **Auth/Permisos**: `platform:view`.
- **Path params**: `id` (string) — ID de la empresa.
- **Respuesta**: `Company` con `subscriptions` (con `plan`, `take: 1`).
- **Errores**: 404 `Company not found.`; 403 de permisos.

#### `POST /api/platform/companies`

- **Descripción**: Crea una empresa nueva.
- **Auth/Permisos**: `platform:companies_manage`.
- **Body (DTO `CreateCompanyDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `name` | string | sí | `@IsString`, `@MaxLength(120)` | Nombre |
  | `slug` | string | no | `@IsString` | Si no se envía, se deriva del nombre |
  | `legalName` | string | no | `@IsString`, `@MaxLength(200)` | Razón social |
  | `taxId` | string | no | `@IsString`, `@MaxLength(20)` | RUC/ID fiscal |
  | `address` | string | no | `@IsString`, `@MaxLength(255)` | Dirección |
  | `email` | string | no | `@IsEmail` | Email |
  | `phone` | string | no | `@IsString` | Teléfono |
  | `timezone` | string | no | `@IsString` | Def. `America/Lima` |
  | `currency` | string | no | `@IsString` | Def. `PEN` |

- **Respuesta**: `Company` creada con `subscriptions` (con `plan`, `take: 1`).
- **Efectos secundarios** (`CompaniesService.create`): crea la empresa en estado `TRIAL` con
  `trialEndsAt = now + 7 días`; si existe el plan `FREE`, crea una `Subscription` `TRIALING`
  `MONTHLY` (inicio ahora, fin = trial). Calcula `profileComplete`/`profileCompletedAt` con
  `isProfileComplete`. No escribe `platform_audit_logs`.
- **Errores**: 409 si viola unicidad (slug, etc., Prisma `P2002`); 400 por validación.

#### `POST /api/platform/companies/with-plan`

- **Descripción**: Crea una empresa con un plan específico.
- **Auth/Permisos**: `platform:companies_manage`.
- **Body (DTO `CreateCompanyWithPlanDto`)**: los mismos campos de `CreateCompanyDto` más:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `planId` | string (UUID) | sí | `@IsUUID` | Plan a asignar |

- **Respuesta**: `Company` con `subscriptions` (con `plan`, `take: 1`).
- **Efectos secundarios** (`CompaniesService.createWithPlan`): crea empresa `TRIAL`, crea
  `Subscription` `TRIALING` `MONTHLY` con el `planId` indicado (fin = now + 7 días). No
  establece `trialEndsAt` en la empresa (a diferencia de `create`).
- **Errores**: 409/400 de Prisma/validación.

#### `POST /api/platform/companies/:id/approve`

- **Descripción**: Aprueba una empresa (la activa).
- **Auth/Permisos**: `platform:companies_manage`.
- **Path params**: `id`.
- **Respuesta**: `CompaniesService.approve` → si la empresa tiene suscripción, la pone
  `ACTIVE` y actualiza la primera suscripción a `ACTIVE`, devolviendo la empresa con
  `subscriptions` (con `plan`); si no tiene suscripción, sólo la pone `ACTIVE`.
- **Efectos secundarios**: escritura en `companies` y `subscriptions`. No escribe `platform_audit_logs`.
- **Errores**: 404 `Company not found.`.

#### `POST /api/platform/companies/:id/reject`

- **Descripción**: Rechaza una empresa.
- **Auth/Permisos**: `platform:companies_manage`.
- **Efectos secundarios**: `CompaniesService.reject` pone la empresa en `SUSPENDED`.
- **Errores**: 404 `Company not found.`.

#### `PATCH /api/platform/companies/:id`

- **Descripción**: Actualiza datos de una empresa.
- **Auth/Permisos**: `platform:companies_manage`.
- **Body (DTO `UpdateCompanyDto`)**: campos opcionales `name` (`MaxLength 120`), `legalName`
  (`MaxLength 200`), `taxId` (`MaxLength 20`), `address` (`MaxLength 255`), `email` (`@IsEmail`),
  `phone`, `timezone`, `currency`.
- **Respuesta**: `Company` actualizada.
- **Efectos secundarios**: actualiza `companies` y recalcula `profileComplete`/`profileCompletedAt`
  con `isProfileComplete`. No escribe `platform_audit_logs`.
- **Errores**: 404 `Company not found.`.

#### `PATCH /api/platform/companies/:id/status`

- **Descripción**: Cambia el estado de una empresa.
- **Auth/Permisos**: `platform:companies_manage`.
- **Body (DTO `UpdateCompanyStatusDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `status` | `'ACTIVE'` \| `'SUSPENDED'` \| `'TRIAL'` \| `'PAST_DUE'` | sí | `@IsIn([...])` | Nuevo estado |

- **Respuesta**: `Company` con el nuevo `status`.
- **Efectos secundarios**: actualiza `companies.status`.
- **Errores**: 404 `Company not found.`; 400 validación.

---

### Planes (controller `PlatformPlansController`, base `platform/plans`)

`@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)`. Delega en `PlansService`.

#### `GET /api/platform/plans`

- **Descripción**: Lista todos los planes (incluye inactivos).
- **Auth/Permisos**: `platform:view`.
- **Respuesta**: `Plan[]` ordenados por `priceMonthly` asc (`findAllAdmin`).
- **Efectos secundarios**: ninguno.
- **Errores**: 403.

#### `POST /api/platform/plans`

- **Descripción**: Crea un plan.
- **Auth/Permisos**: `platform:plans_manage`.
- **Body (DTO `CreatePlanDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `code` | string | sí | `@IsString` | Código único |
  | `name` | string | sí | `@IsString` | Nombre |
  | `description` | string | no | `@IsString` | Descripción |
  | `priceMonthly` | number | sí | `@IsNumber`, `@Type(Number)` | Precio mensual |
  | `priceYearly` | number | sí | `@IsNumber`, `@Type(Number)` | Precio anual |
  | `billingCycle` | `'MONTHLY'`\|`'YEARLY'` | sí | `@IsIn` | Ciclo |
  | `maxUsers` | number | no | `@IsInt`, `@Min(1)` | Límite usuarios |
  | `maxProducts` | number | no | `@IsInt`, `@Min(1)` | Límite productos |
  | `features` | string[] | sí | `@IsArray` | Features |
  | `modules` | string[] | no | `@IsArray`, `@IsIn(PLAN_MODULE_KEYS, each)` | Módulos válidos |
  | `permissions` | string[] | no | `@IsArray`, `@IsIn(PLAN_FEATURE_KEYS, each)` | Claves de plan (se guardan en `permissions`) |
  | `apiEnabled` | boolean | no | `@IsBoolean` | Def. false |
  | `apiSearchDniEnabled` | boolean | no | `@IsBoolean` | Def. false |
  | `apiQuota` | number | no | `@IsInt`, `@Min(0)` | Def. 0 |
  | `isActive` | boolean | no | `@IsBoolean` | Def. true |

- **Respuesta**: `Plan` creado.
- **Efectos secundarios**: inserta en `plans`. No escribe `platform_audit_logs`.
- **Errores**: 409 por `code` duplicado (Prisma); 400 validación (keys inválidas de módulos/features).

#### `PATCH /api/platform/plans/:id`

- **Descripción**: Actualiza un plan.
- **Auth/Permisos**: `platform:plans_manage`.
- **Body (DTO `UpdatePlanDto`)**: mismos campos que `CreatePlanDto` salvo `code`, todos opcionales.
- **Respuesta**: `Plan` actualizado.
- **Efectos secundarios**: actualiza `plans`.
- **Errores**: 404 `Plan not found.`; 400 validación.

#### `DELETE /api/platform/plans/:id`

- **Descripción**: Elimina un plan.
- **Auth/Permisos**: `platform:plans_manage`.
- **Efectos secundarios**: `prisma.plan.delete` (borrado físico). Puede fallar por FKs si hay
  suscripciones asociadas.
- **Errores**: 404 `Plan not found.`; error Prisma si el plan está referenciado.

---

### Suscriptores (controller `PlatformSubscriptionsController`, base `platform/subscriptions`)

`@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)`. Delega en `SubscriptionsService`.

#### `GET /api/platform/subscriptions/subscribers`

- **Descripción**: Lista suscriptores (empresas con su suscripción).
- **Auth/Permisos**: `platform:view`.
- **Query params**: `status` (string, opcional), `planId` (string, opcional), `page` (def. 1),
  `limit` (def. 20).
- **Respuesta**: `{ data, total, page, limit, totalPages }` donde cada item tiene
  `id` (= `company.id`), `name`, `email`, `status` (company), `createdAt`, y un objeto
  `subscription` con `id`, `status`, `provider`, `billingCycle`, `startDate`, `endDate`,
  `plan` (id/name/code/precios), `autoRenew`, `payments` (último pago) y `company`.
- **Efectos secundarios**: ninguno.
- **Errores**: 403.

#### `GET /api/platform/subscriptions/stats`

- **Descripción**: Conteo de suscripciones agrupadas por estado.
- **Auth/Permisos**: `platform:view`.
- **Respuesta**: resultado de `groupBy({ by: ['status'], _count: { status: true } })`.
- **Errores**: 403.

#### `PATCH /api/platform/subscriptions/subscribers/:id/approve`

- **Descripción**: Aprueba una suscripción.
- **Auth/Permisos**: `platform:companies_manage`.
- **Path params**: `id` (string) — ID de la **suscripción** (`subscription.id`), aunque en el
  listado el `id` mostrado es el de la empresa.
- **Respuesta**: `Subscription` actualizada (`status: ACTIVE`).
- **Efectos secundarios** (`SubscriptionsService.approveSubscriber`): transacción que pone la
  `Subscription` `ACTIVE` y la `Company` `ACTIVE`; crea una `Notification`
  (`type: SUBSCRIPTION`, `channel: IN_APP`, título "Suscripción aprobada") al `COMPANY_ADMIN`
  si existe. Tras la transacción: `planCapabilities.invalidate(companyId)` (invalida caché de
  capacidades de plan). No escribe `platform_audit_logs`.
- **Errores**: 404 `Subscription not found.`; 403.

#### `PATCH /api/platform/subscriptions/subscribers/:id/reject`

- **Descripción**: Rechaza una suscripción (la cancela).
- **Auth/Permisos**: `platform:companies_manage`.
- **Path params**: `id` — ID de la suscripción.
- **Respuesta**: `Subscription` con `status: CANCELED`.
- **Efectos secundarios**: transacción que actualiza la suscripción a `CANCELED`;
  `planCapabilities.invalidate(companyId)`. `rejectSubscriber` acepta un `reason` opcional
  pero el controller no lo envía. No cambia el estado de la empresa.
- **Errores**: 404 `Subscription not found.`; 403.

---

### Solicitudes de checkout (controller `PlatformCheckoutRequestsController`, base `platform/checkout-requests`)

`@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)`. Delega en `CheckoutRequestsService`.

#### `GET /api/platform/checkout-requests/pending`

- **Descripción**: Lista solicitudes de checkout en estado `SUBMITTED`.
- **Auth/Permisos**: `platform:companies_manage`.
- **Respuesta**: array con `id`, `fullName`, `companyName`, `email`, `provider`, `amount`,
  `currency`, `status`, `proofImageBase64`, `reviewNotes`, `reviewedBy`, `reviewedAt`,
  `createdAt`, `submittedAt`, y `plan` (`code`, `name`). Orden `createdAt` asc.
- **Errores**: 403.

#### `PATCH /api/platform/checkout-requests/:requestId/review`

- **Descripción**: Revisa una solicitud de checkout (aprobar/rechazar).
- **Auth/Permisos**: `platform:companies_manage`.
- **Path params**: `requestId` (string).
- **Body (DTO `ReviewCheckoutRequestDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `status` | `CheckoutReviewStatus` (`APPROVED`\|`REJECTED`) | sí | `@IsEnum` | Resultado |
  | `reviewNotes` | string | no | `@IsString` | Notas |

- **Respuesta** (según `CheckoutRequestsService.review`):
  - Rechazo: `{ requestId, status: 'REJECTED' }`.
  - Aprobación de empresa existente (upgrade): `{ requestId, status: 'APPROVED', subscriptionId }`.
  - Aprobación de cliente nuevo: `{ requestId, status: 'APPROVED', companyId }`.
- **Efectos secundarios**:
  - **Rechazo**: marca `checkout_requests` como `REJECTED` con `reviewedBy/At/reviewNotes`;
    envía email `sendSubscriptionRejected(request.email, request.companyName)`.
  - **Aprobación con empresa existente** (`request.companyId` presente → `handleUpgradeApproval`):
    si el plan no es `FREE`, valida perfil completo (si no → 400). En transacción: marca la
    solicitud `REVIEWING`, pone la `Company` `ACTIVE`, crea o actualiza la `Subscription`
    (`ACTIVE`, `startDate` ahora, `endDate` +1/+12 meses según `billingCycle`), crea un `Payment`
    `SUCCEEDED` con `providerPaymentId = upgrade-<id>`, y marca la solicitud `APPROVED`. Fuera
    de la transacción: notifica (IN_APP, `PLAN_UPGRADED`) a todos los `COMPANY_ADMIN` activos de
    la empresa y envía email `sendSubscriptionApproved`.
  - **Aprobación de cliente nuevo** (`handleNewCustomerApproval`): en transacción marca la
    solicitud `REVIEWING`; valida que el email no exista (si existe → 409); si el plan no es
    `FREE`, exige perfil completo (si no → 400); crea `Company` (`ACTIVE`, slug único con
    sufijo de tiempo), crea `User` (`globalRole USER`, `isActive`) con `Membership`
    `COMPANY_ADMIN`, crea `Subscription` (`ACTIVE`, `autoRenew: true`), crea `Payment`
    `SUCCEEDED` con `transactionId = proof-<id>`, y actualiza la solicitud a `APPROVED`
    enlazando `companyId`, `userId`, `subscriptionId`. Envía email `sendSubscriptionApproved`.
  - No escribe `platform_audit_logs`.
- **Errores**: 404 `Solicitud no encontrada`; 409 `La solicitud no está pendiente de revisión`
  o `El correo electrónico ya está registrado.`; 400 si el perfil de empresa está incompleto.

---

### Solicitudes de upgrade de plan (controller `PlatformUpgradeRequestsController`, base `platform/upgrade-requests`)

`@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)`. Delega en `PlanUpgradeRequestsService`.

#### `GET /api/platform/upgrade-requests/pending`

- **Descripción**: Lista solicitudes `plan_upgrade_requests` en estado `PENDING`.
- **Auth/Permisos**: `platform:companies_manage`.
- **Respuesta**: array de solicitudes con `company` (`id`, `name`, `email`) y `plan` completos,
  orden `createdAt` asc.
- **Errores**: 403.

#### `POST /api/platform/upgrade-requests/:id/review`

- **Descripción**: Revisa una solicitud de upgrade de plan.
- **Auth/Permisos**: `platform:companies_manage`.
- **Path params**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `id` | string (UUID) | sí | `ParseUUIDPipe` | ID de la solicitud |

- **Body (DTO `ReviewPlanUpgradeDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `status` | `'APPROVED'` \| `'REJECTED'` | sí | `@IsString`, `@IsNotEmpty` (sin `@IsEnum`) | Resultado |
  | `reviewNotes` | string | no | `@IsString` | Notas |

- **Respuesta**: `{ requestId, status: 'REJECTED' }` o `{ requestId, status: 'APPROVED' }`.
- **Efectos secundarios** (`PlanUpgradeRequestsService.review`):
  - **Rechazo**: marca la solicitud `REJECTED` con revisor/notas; si hay `COMPANY_ADMIN`, envía
    email `sendSubscriptionRejected`. No invalida caché.
  - **Aprobación**: en transacción marca `APPROVED`; si el plan no es `FREE`, exige perfil
    completo (si no → 400); busca la suscripción de la empresa (si no existe → 404); actualiza
    la `Subscription` (`planId`, `billingCycle`, `startDate` ahora, `endDate` +1/+12, `ACTIVE`,
    `provider` con fallback `CASH`); pone la `Company` `ACTIVE`; crea un `Payment` `SUCCEEDED`
    con `transactionId = upgrade-<id>`. Fuera de la transacción:
    `planCapabilities.invalidate(companyId)`; si hay `COMPANY_ADMIN`, crea `Notification`
    (`SUBSCRIPTION_APPROVED`, IN_APP, "Plan actualizado") y envía email
    `sendSubscriptionApproved`.
  - No escribe `platform_audit_logs`.
- **Errores**: 404 `Solicitud no encontrada` / `Suscripción no encontrada`; 409 `La solicitud
  no está pendiente de revisión`; 400 perfil incompleto.

---

### Administradores de plataforma (controller `PlatformAdminsController`, base `platform/admins`)

`@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)`. Delega en `PlatformAdminsService`.

#### `GET /api/platform/admins`

- **Descripción**: Lista usuarios con `globalRole` `SUPER_ADMIN` o `SUPPORT_ADMIN`.
- **Auth/Permisos**: `platform:view`.
- **Respuesta**: array con `id`, `email`, `fullName`, `globalRole`, `isActive`, `createdAt`,
  orden `createdAt` asc.
- **Errores**: 403.

#### `GET /api/platform/admins/candidates`

- **Descripción**: Lista usuarios candidatos a admin (globalRole `USER`).
- **Auth/Permisos**: `platform:view`.
- **Query params**: `q` (string, opcional) — filtra por `email` o `fullName` (contains, insensitive).
- **Respuesta**: hasta 50 usuarios con `id`, `email`, `fullName`, `isActive`, `createdAt`,
  orden `createdAt` desc.
- **Errores**: 403.

#### `POST /api/platform/admins/:userId/grant`

- **Descripción**: Otorga el rol `SUPPORT_ADMIN` a un usuario.
- **Auth/Permisos**: `platform:admins_manage`.
- **Path params**: `userId` (string).
- **Respuesta**: `User` actualizado (o el usuario sin cambios si ya era `SUPPORT_ADMIN`).
- **Efectos secundarios** (`PlatformAdminsService.grantSupportAdmin`): `user.update` con
  `globalRole: 'SUPPORT_ADMIN'`. No escribe `platform_audit_logs`.
- **Errores**: 404 `Usuario #<id> no encontrado`; 400 `No se puede modificar a un SUPER_ADMIN.`

#### `POST /api/platform/admins/:userId/revoke`

- **Descripción**: Revoca el rol de plataforma (vuelve a `USER`).
- **Auth/Permisos**: `platform:admins_manage`.
- **Path params**: `userId` (string).
- **Respuesta**: `User` actualizado (o sin cambios si no era `SUPPORT_ADMIN`).
- **Efectos secundarios** (`PlatformAdminsService.revokeAdmin`): `user.update` con
  `globalRole: 'USER'`. El `actorId` se toma de `@CurrentUser().sub`.
- **Errores**: 404 `Usuario #<id> no encontrado`; 400 `No se puede revocar a un SUPER_ADMIN.`;
  400 `No puedes revocar tu propio acceso.`

---

### Métricas (controller `PlatformMetricsController`, base `platform/metrics`)

`@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)`. Delega en `PlatformMetricsService`.

#### `GET /api/platform/metrics/overview`

- **Descripción**: Métricas agregadas de la plataforma.
- **Auth/Permisos**: `platform:view`.
- **Respuesta** (`PlatformMetricsService.getOverview`):

  ```json
  {
    "generatedAt": "<ISO>",
    "companies": { "total": 0, "byStatus": { "ACTIVE": 0, "...": 0 } },
    "users": { "total": 0, "platformAdmins": 0 },
    "plans": { "active": 0 },
    "subscriptions": { "active": 0, "byPlan": [{ "planId": "", "code": null, "name": null, "count": 0 }] },
    "revenue": { "month": "YYYY-MM", "currency": "PEN", "total": 0 },
    "requests": { "pendingCheckouts": 0, "pendingUpgrades": 0 }
  }
  ```

- **Detalles**: `platformAdmins` = usuarios `SUPER_ADMIN`/`SUPPORT_ADMIN`; `subscriptions.byPlan`
  agrupa suscripciones `ACTIVE` por `planId`; `revenue.total` = suma de `Payment.amount` con
  `status SUCCEEDED` y `createdAt >= inicio de mes`; `pendingCheckouts` = checkout `SUBMITTED`;
  `pendingUpgrades` = plan upgrade `PENDING`.
- **Efectos secundarios**: ninguno (lecturas).
- **Errores**: 403.

---

### Auditoría (controller `PlatformAuditController`, base `platform/audit`)

`@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)`. Usa `AuditService`.

#### `GET /api/platform/audit`

- **Descripción**: Auditoría global. Consulta la tabla `audit_logs` (auditoría de empresa), **no**
  `platform_audit_logs`. No fija `companyId`, por lo que devuelve registros de todas las empresas.
- **Auth/Permisos**: `platform:audit_view`.
- **Query params** (interface `AuditQueryDto`, **sin** validación por `class-validator`):

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `userId` | string | no | — | Filtra por usuario |
  | `entity` | string | no | — | Filtra por entidad |
  | `action` | `AuditAction` | no | — | `CREATE`/`UPDATE`/`DELETE`/`LOGIN`/`LOGOUT`/`EXPORT` |
  | `from` | string (fecha) | no | convertido con `new Date(...)` | Desde (inclusive) |
  | `to` | string (fecha) | no | convertido con `new Date(...)` | Hasta (inclusive) |
  | `page` | string (number) | no | convertido con `Number(...)`, def. 1 | Página |
  | `limit` | string (number) | no | convertido con `Number(...)`, def. 50, tope 200 | Tamaño |

- **Respuesta**: `{ items, total, page, limit, totalPages }`. Cada item es un `audit_logs`
  con `user` (`id`, `email`, `fullName`), orden `createdAt` desc.
- **Efectos secundarios**: ninguno.
- **Errores**: 403.

---

## Funciones del service (`PlatformAdminsService`)

### `list()`
- **Qué hace**: Lista usuarios con `globalRole` en `['SUPER_ADMIN','SUPPORT_ADMIN']`.
- **Devuelve**: usuarios con `id, email, fullName, globalRole, isActive, createdAt` (orden asc).

### `listCandidates(query?)`
- **Qué hace**: Busca usuarios `globalRole = 'USER'`; si `query`, filtra por `email`/`fullName`
  (contains, insensitive).
- **Devuelve**: hasta 50 usuarios con `id, email, fullName, isActive, createdAt` (orden desc).

### `grantSupportAdmin(userId)`
- **Qué hace**: Cambia `globalRole` del usuario a `SUPPORT_ADMIN`.
- **Escribe en**: `users`.
- **Devuelve**: `User` (o el usuario sin cambios si ya era `SUPPORT_ADMIN`).
- **Lanza**: `NotFoundException` si no existe; `BadRequestException` si es `SUPER_ADMIN`.

### `revokeAdmin(userId, actorId)`
- **Qué hace**: Cambia `globalRole` del usuario a `USER`.
- **Escribe en**: `users`.
- **Devuelve**: `User` (o el usuario sin cambios si no era `SUPPORT_ADMIN`).
- **Lanza**: `NotFoundException` si no existe; `BadRequestException` si es `SUPER_ADMIN` o si
  `userId === actorId`.

## Métodos de `PlatformMetricsService`

### `getOverview()`
- **Qué hace**: Agrega métricas globales (empresas por estado, usuarios totales y admins de
  plataforma, planes activos, suscripciones activas por plan, ingresos del mes, solicitudes
  pendientes). Ver forma de la respuesta en `GET /api/platform/metrics/overview`.

---

## Servicios reutilizados (comportamiento relevante)

### `PaymentSettingsService` (`backend/src/modules/payments/payment-settings.service.ts`)
- `getAllSettings()`: `findMany` orden `provider` asc.
- `updateSettings(provider, data)`: upsert por `provider` (busca `findFirst`, luego `update`/`create`).
- `getPendingProofs()`: `payment_proofs` con `status PENDING`, orden asc.
- `reviewProof(proofId, reviewerId, data)`: ver endpoint. Actualiza el comprobante sólo si seguía
  `PENDING`; si `APPROVED`, transacción (`payment` pendiente→`SUCCEEDED`, `subscription`→`ACTIVE`
  con extensión de `endDate`, `company`→`ACTIVE`). **No** escribe `platform_audit_logs` ni
  dispara emails/notificaciones.

### `CheckoutRequestsService` (`backend/src/modules/payments/checkout-requests.service.ts`)
- `getPending()`: checkout `SUBMITTED`, orden asc, con `plan`.
- `review(...)`: ver endpoint de checkout. También acepta `reviewNotes` para `handleUpgradeApproval`.
- `submitProof`, `createRequest`: usados por el flujo público/empresa (no por este módulo de
  plataforma, pero comparten servicio).

### `CompaniesService` (`backend/src/modules/companies/companies.service.ts`)
- Usa `isProfileComplete`/`evaluateProfile` (helpers de perfil). Crea suscripción `FREE` al
  crear empresa si existe el plan FREE.

### `PlansService` (`backend/src/modules/plans/plans.service.ts`)
- `findAllAdmin()`, `create`, `update`, `remove` (delete físico).

### `SubscriptionsService` (`backend/src/modules/subscriptions/subscriptions.service.ts`)
- `findAllSubscribers`, `getStats`, `approveSubscriber`, `rejectSubscriber` (ver endpoints).
- También expone `processExpiredTrials`, `cancelSubscription`, `upgradePlan` (este último lanza
  `NotFoundException('Use plan-upgrade-requests module for upgrades')`), no usados por este módulo.

### `PlanUpgradeRequestsService` (`backend/src/modules/subscriptions/plan-upgrade-requests.service.ts`)
- `getPending()` y `review(...)` (ver endpoint). Comparte `submitProof`/`createRequest` con el
  flujo de empresa.

---

## Observaciones de verificación

- **`platform_audit_logs`**: no se encontró ninguna escritura a esa tabla en
  `backend/src` (grep de `platformAuditLog`/`platform_audit_logs` sin resultados). El módulo
  `platform` **no registra** auditoría en `platform_audit_logs`; el endpoint de auditoría lee
  `audit_logs` (registros por empresa).
- **`@RequirePlan`/`@RequireModule`/`@RequireFeature`**: ninguno aparece en los controllers de
  este módulo. Columna "Plan" = "ninguno" para todos los endpoints.
- **`@Roles([...])`**: ningún controller de este módulo usa `@Roles`; la autorización de
  plataforma se hace con `PlatformGuard` (roles `SUPER_ADMIN`/`SUPPORT_ADMIN`) + `PermissionsGuard`.
- **`reviewProof`**: obtiene el revisor de `@Query('userId')`, no de `@CurrentUser()`; el
  controller no valida que ese `userId` corresponda al usuario autenticado (según el código leído).
- **`rejectSubscriber(reason?)`**: el parámetro `reason` existe en el service pero el controller
  no lo envía.
- **`SubscriptionsService.findAllSubscribers`**: el `id` devuelto por item es el `company.id`,
  mientras que aprobar/rechazar esperan el `subscription.id` (`:id`). Comportamiento a tener en
  cuenta al consumir la API.
- **Query params numéricos** (`page`, `limit`) en companies/subscriptions: se declaran como
  `?: number` pero llegan como string por query y se pasan al service sin `ParseIntPipe`
  (el `ValidationPipe` global no transforma primitivos de `@Query` sin DTO/clase).
- **`AuditQueryDto`** es una `interface` (no clase con decoradores), por lo que la validación
  global no aplica a sus campos.
