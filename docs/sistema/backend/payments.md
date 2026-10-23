# Módulo: Payments (pagos, checkout y configuración de pasarelas)

## Propósito
Agrupa tres áreas: gestión de pagos de la suscripción y recibos (`/payments`), solicitudes de checkout para alta de empresa o upgrade (`/payments/checkout`) y configuración de métodos de pago / comprobantes (`/payment-settings`). Incluye la integración con MercadoPago (incluido webhook) y métodos de pago offline (Yape, Plin, Transferencia).

## Archivos clave
- `backend/src/modules/payments/payments.controller.ts` — endpoints bajo `payments`.
- `backend/src/modules/payments/payments.service.ts` — lógica de pagos, sesiones de checkout y webhooks.
- `backend/src/modules/payments/checkout-requests.controller.ts` — endpoints bajo `payments/checkout`.
- `backend/src/modules/payments/checkout-requests.service.ts` — lógica de solicitudes de checkout.
- `backend/src/modules/payments/payment-settings.controller.ts` — endpoints bajo `payment-settings`.
- `backend/src/modules/payments/payment-settings.service.ts` — configuración de proveedores y comprobantes.
- `backend/src/modules/payments/dto/checkout-requests.dto.ts` — `CreateCheckoutRequestDto`, `SubmitCheckoutProofDto`, `ReviewCheckoutRequestDto`, `CheckoutReviewStatus`.
- `backend/src/modules/payments/dto/payment-settings.dto.ts` — DTOs de settings y comprobantes.
- `backend/src/modules/payments/payments.module.ts` — importa `PrismaModule`, `NotificationsModule`, `EmailModule`; exporta los tres servicios.
- Archivos de test: `checkout-requests.controller.spec.ts`, `payment-settings.service.spec.ts`, `payments.service.spec.ts`.

> Nota: el prefijo real del tercer controlador es `payments/checkout` (no `/checkout-requests`). Los tres prefijos reales son `/api/payments`, `/api/payments/checkout` y `/api/payment-settings`.

---

## Controlador `PaymentsController` (`/api/payments`)

### GET /api/payments
- **Descripción**: Devuelve los pagos de la suscripción más reciente de la empresa. Si no hay suscripciones, `[]`.
- **Auth**: JWT (global) + guards del método.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de `Payment`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### GET /api/payments/pending
- **Descripción**: Devuelve los pagos `PENDING` de la suscripción `ACTIVE` de la empresa. Sin suscripción `ACTIVE` → `[]`.
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de `Payment`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### GET /api/payments/history
- **Descripción**: Historial paginado de pagos de la suscripción de la empresa.
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Path params**: ninguno.
- **Query**: `page?` (`DefaultValuePipe(1)`, `ParseIntPipe`), `limit?` (`DefaultValuePipe(20)`, `ParseIntPipe`).
- **Body**: no aplica.
- **Respuesta**: `{ data, total, page, limit, totalPages }`. Sin suscripción: `{ data: [], total: 0, page, limit, totalPages: 0 }`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### GET /api/payments/current-pending
- **Descripción**: Devuelve el pago `PENDING` más reciente de la suscripción de la empresa; `null` si no hay suscripción.
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: `Payment` o `null`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### POST /api/payments/:id/proof
- **Descripción**: Sube un comprobante (Base64) para un pago `PENDING`.
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Path params**: `id` (string) — ID del pago.
- **Query**: ninguno.
- **Body (DTO `UploadPaymentImageDto`)**: `{ imageBase64: string; paymentDate?: Date }`.
- **Respuesta**: `PaymentProof` creado (status `PENDING`).
- **Efectos secundarios**: escribe `payment_proofs` (`subscriptionId`, `imageBase64` saneada con `sharp`, `amount` del pago, `paymentDate`).
- **Errores**: `400 BadRequestException` (`'Este pago ya fue procesado'`; imagen inválida/demasiado grande — DTO `@MaxLength(2_000_000) @Matches(/data:image\/(png|jpe?g|webp);base64,/)`), `404 NotFoundException` (`'Pago no encontrado'`).

### GET /api/payments/:id
- **Descripción**: Detalle de un pago con su suscripción (`plan`, `company`).
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Path params**: `id` (string).
- **Query / Body**: no aplica.
- **Respuesta**: `Payment` con `subscription`.
- **Efectos secundarios**: ninguno.
- **Errores**: `404 NotFoundException` (`'Pago no encontrado'`).

### GET /api/payments/:id/receipt
- **Descripción**: Genera un recibo (objeto calculado, no persistido) con datos de empresa, plan y montos (IGV 18%).
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Path params**: `id` (string).
- **Query / Body**: no aplica.
- **Respuesta**: `{ id: 'RCP-XXXXXXXX', generatedAt, dueDate, company: { name, taxId }, plan: { name, priceMonthly }, payment: { id, amount, currency, status, provider, createdAt }, subtotal, igv, total }`.
- **Efectos secundarios**: ninguno (no escribe).
- **Errores**: `404 NotFoundException` si el pago no existe (vía `findOne`).

### PATCH /api/payments/:id/mark-paid
- **Descripción**: Marca un pago `PENDING` como `SUCCEEDED`, extiende la suscripción y activa la empresa.
- **Auth**: JWT + `@Roles('COMPANY_ADMIN', 'MANAGER')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)`.
- **Path params**: `id` (string).
- **Query**: ninguno.
- **Body**: `{ paymentDate?: string }`.
- **Respuesta**: el pago actualizado más `{ message: 'Pago marcado como completado' }`.
- **Efectos secundarios**: escribe `payments` (`status='SUCCEEDED'`, `paidAt`, `providerPaymentId` = `paid-<id>` o `manual-<id>`), `subscriptions` (`status='ACTIVE'`, nuevo `endDate`), `companies.status='ACTIVE'`. No invalida cache ni notifica.
- **Errores**: `400 BadRequestException` (`'Este pago ya fue procesado'`), `404 NotFoundException` (`'Pago no encontrado'`).

### GET /api/payments/admin/pending
- **Descripción**: Lista paginada global de pagos `PENDING` con suscripción (plan, company).
- **Auth**: JWT + `@Roles('SUPER_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params**: ninguno.
- **Query**: `page?` (def. 1), `limit?` (def. 20).
- **Body**: no aplica.
- **Respuesta**: `{ data, total, page, limit, totalPages }`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### GET /api/payments/admin/stats
- **Descripción**: Estadísticas globales de pagos (pendientes, exitosos y recaudación del mes).
- **Auth**: JWT + `@Roles('SUPER_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: `{ pending: { count, amount }, succeeded: { count, amount }, monthlyRevenue }`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### POST /api/payments/checkout-session/:provider
- **Descripción**: Crea una sesión/intención de checkout según el proveedor (`mercadopago` o `yape`; otros devuelven nota).
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Path params**: `provider` (string).
- **Query**: ninguno.
- **Body**: `{ planCode: string }`.
- **Respuesta**:
  - `mercadopago`: `{ provider, status, paymentId, redirectUrl, planCode, companyId, amount, currency }` o `{ provider, status: 'error', error, ... }`.
  - `yape`: `{ provider, planCode, companyId, status: 'pending', instructions, amount, currency: 'PEN' }`.
  - otros: `{ provider, planCode, companyId, status: 'pending', note: 'Provider not implemented yet' }`.
- **Efectos secundarios**: para `mercadopago` llama a la librería `mercadopago` (no escribe en BD). No invalida cache.
- **Errores**: `Error('Plan not found')` (no es una `HttpException`).

### POST /api/payments/webhooks/:provider
- **Descripción**: Endpoint público de webhooks. Para `mercadopago` verifica firma y, si `status === 'approved'`, activa la suscripción.
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: `provider` (string).
- **Query**: cualquiera (se pasa como `Record<string, unknown>`; se lee `data.id`).
- **Body**: payload del proveedor (`unknown`).
- **Respuesta**: `{ provider, received: true, processed: true }`.
- **Efectos secundarios**: si es un pago aprobado, escribe `subscriptions` (upsert), `companies.status='ACTIVE'`, `payments`; crea `Notification` (`PAYMENT_RECEIVED`) y envía email `payment-received`.
- **Errores**: `401 UnauthorizedException` (secreto no configurado, firma ausente/expirada/inválida).

---

## Controlador `CheckoutRequestsController` (`/api/payments/checkout`)

### POST /api/payments/checkout/requests
- **Descripción**: Crea (o reutiliza) una solicitud de checkout. Si hay usuario autenticado con `companyId` es un upgrade; sin sesión es alta de nueva empresa.
- **Auth**: público (`@Public()`) + `@UseGuards(OptionalJwtAuthGuard)`. Si el body envía `companyId` sin usuario con empresa → rechaza.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(OptionalJwtAuthGuard)`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body (DTO `CreateCheckoutRequestDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `fullName` | string | no | `@IsOptional @IsString @MinLength(2)` | Nombre (requerido sin sesión, validado en servicio) |
| `companyName` | string | no | `@IsOptional @IsString @MinLength(2)` | Empresa (requerido sin sesión) |
| `email` | string | no | `@IsOptional @IsEmail` | Email (requerido sin sesión) |
| `password` | string | no | `@IsOptional @IsString @MinLength(8)` | Password (requerido sin sesión) |
| `taxId` | string | no | `@Matches(/^\d{11}$/)` | RUC |
| `legalName` | string | no | `@IsOptional @IsString @MinLength(3)` | Razón social |
| `address` | string | no | `@IsOptional @IsString @MinLength(10)` | Dirección |
| `phone` | string | no | `@IsOptional @IsString` | Teléfono |
| `planCode` | string | sí | `@IsString` | Código del plan |
| `paymentMethod` | `PaymentProvider` | sí | `@Transform` a mayúsculas + `@IsEnum` | Debe ser offline (`YAPE`/`PLIN`/`TRANSFER`) |
| `companyId` | string | no | `@IsOptional @IsString` | Solo válido con sesión |
| `idempotencyKey` | string | no | `@MaxLength(100) @Matches(/^[A-Za-z0-9._-]+$/)` | Idempotencia |

- **Respuesta** (`buildCheckoutResponse`): `{ requestId, status, plan: { code, name, billingCycle, amount }, paymentMethod, paymentSetting: {...} | null }`.
- **Efectos secundarios**: escribe `checkout_requests` (status `DRAFT`); puede reutilizar una solicitud existente; con sesión usa `company.name` y `email:''`, `passwordHash:''`. Sin sesión hashea password con argon2.
- **Errores**: `400` (método no soportado; faltan datos de registro; perfil incompleto), `401` (`'Sesion invalida para realizar esta operacion.'` desde el controlador), `404` (empresa o plan no encontrado), `409` (`'El correo electrónico ya está registrado.'`, `'Método de pago no disponible'`).

### POST /api/payments/checkout/requests/:requestId/proof
- **Descripción**: Sube el comprobante de una solicitud `DRAFT` y la pasa a `SUBMITTED`. Envía email de comprobante recibido.
- **Auth**: público + `@UseGuards(OptionalJwtAuthGuard)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(OptionalJwtAuthGuard)`.
- **Path params**: `requestId` (string).
- **Query**: ninguno.
- **Body (DTO `SubmitCheckoutProofDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `imageBase64` | string | sí | `@IsString @MaxLength(2_000_000) @Matches(/data:image\/(png\|jpe?g\|webp);base64,/)` | Data URL PNG/JPEG/WebP (se sanea con `sharp` al guardar) |
| `paymentDate` | Date | no | `@IsOptional @Type(Date) @IsDate` | Fecha de pago |

- **Respuesta**: `{ requestId, status: 'SUBMITTED' }`.
- **Efectos secundarios**: escribe `checkout_requests` (`proofImageBase64`, `paymentDate`, `submittedAt`, `status='SUBMITTED'`); envía email `sendPaymentProofReceived`.
- **Errores**: `400` (formato inválido), `404` (solicitud no encontrada; o `companyId` en solicitud sin sesión), `409` (ya enviada o revisada).

### GET /api/payments/checkout/requests/pending
- **Descripción**: Lista solicitudes `SUBMITTED` con datos seleccionados para revisión.
- **Auth**: JWT + `@Roles(GlobalRole.SUPER_ADMIN)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array con `id, fullName, companyName, email, provider, amount, currency, status, proofImageBase64, reviewNotes, reviewedBy, reviewedAt, createdAt, submittedAt, plan:{code,name}`.
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### PATCH /api/payments/checkout/requests/:requestId/review
- **Descripción**: Revisa una solicitud `SUBMITTED`. Rechazo o aprobación (upgrade si la solicitud tiene `companyId`; alta de nuevo cliente si no).
- **Auth**: JWT + `@Roles(GlobalRole.SUPER_ADMIN)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params**: `requestId` (string).
- **Query**: ninguno.
- **Body (DTO `ReviewCheckoutRequestDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `status` | `CheckoutReviewStatus` (`APPROVED`/`REJECTED`) | sí | `@IsEnum` | Resultado |
| `reviewNotes` | string | no | `@IsOptional @IsString` | Notas |

- **Respuesta**: `{ requestId, status, subscriptionId? }` (upgrade) o `{ requestId, status, companyId }` (nuevo cliente).
- **Efectos secundarios**:
  - Rechazo: escribe `checkout_requests` (`REJECTED`, `reviewedBy/At`, `reviewNotes`); envía email `sendSubscriptionRejected`.
  - Upgrade: transacción que marca `REVIEWING` → `APPROVED`, actualiza `companies.status='ACTIVE'`, crea/actualiza `subscriptions`, crea `Payment` (`providerPaymentId='upgrade-<id>'`); notifica (`PLAN_UPGRADED`, IN_APP) a los `COMPANY_ADMIN`; envía email `sendSubscriptionApproved`. No invalida cache `plan:caps`.
  - Nuevo cliente: transacción que marca `REVIEWING`→`APPROVED`, crea `Company`, `User` (rol global `USER`, membership `COMPANY_ADMIN`), `Subscription`, `Payment` (`transactionId='proof-<id>'`) y enlaza `companyId`/`userId`/`subscriptionId` en la solicitud; envía email `sendSubscriptionApproved`. No invalida cache.
- **Errores**: `400` (perfil incompleto al aprobar plan de pago), `404` (solicitud no encontrada), `409` (no pendiente; email ya registrado en alta).

---

## Controlador `PaymentSettingsController` (`/api/payment-settings`)

### GET /api/payment-settings
- **Descripción**: Lista pública de configuración de proveedores (campos públicos).
- **Auth**: público (`@Public()`).
- **Plan / Guards extra**: ninguno.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de `PaymentSettingsPublicResponseDto` (`id, provider, isEnabled, qrImageBase64, accountNumber, accountName, instructions`).
- **Efectos secundarios / Errores**: ninguno.

### GET /api/payment-settings/provider/:provider
- **Descripción**: Configuración pública de un proveedor.
- **Auth**: público (`@Public()`).
- **Plan / Guards extra**: ninguno.
- **Path params**: `provider` (`ParseEnumPipe(PaymentProvider)`).
- **Query / Body**: no aplica.
- **Respuesta**: `PaymentSettingsPublicResponseDto` o `null`.
- **Efectos secundarios / Errores**: ninguno.

### PATCH /api/payment-settings/provider/:provider
- **Descripción**: Crea o actualiza la configuración de un proveedor.
- **Auth**: JWT + `@Roles(GlobalRole.SUPER_ADMIN)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params**: `provider` (`ParseEnumPipe(PaymentProvider)`).
- **Query**: ninguno.
- **Body (DTO `UpdatePaymentSettingsDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `isEnabled` | boolean | no | `@IsOptional @IsBoolean` | Habilitado |
| `qrImageBase64` | string | no | `@IsOptional @IsString @MaxLength(500000) @ValidateIf(!='') @Matches(/data:image\/(png\|jpe?g\|webp);base64,/)` | QR (se sanea con `sharp`, límite 500KB) |
| `accountNumber` | string | no | `@IsOptional @IsString @MaxLength(50)` | Número de cuenta |
| `accountName` | string | no | `@IsOptional @IsString @MaxLength(100)` | Titular |
| `instructions` | string | no | `@IsOptional @IsString @MaxLength(1000)` | Instrucciones |
| `config` | object | no | `@IsOptional @IsObject @Type(Object)` | Config extra |

- **Respuesta**: `PaymentSettingsResponseDto`.
- **Efectos secundarios**: escribe `payment_settings` (update si existe, create si no; `config` por defecto `{}`).
- **Errores**: ninguno explícito.

### POST /api/payment-settings/proof/:subscriptionId
- **Descripción**: Sube un comprobante de pago para una suscripción de la empresa.
- **Auth**: JWT (global, sin `@Roles`). Requiere `user.companyId` (si no, `403`).
- **Plan**: ninguno.
- **Guards extra**: ninguno explícito (usa guard global `JwtAuthGuard`).
- **Path params**: `subscriptionId` (string).
- **Query**: ninguno.
- **Body (DTO `UploadPaymentProofDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `imageBase64` | string | sí | `@IsString @MaxLength(2_000_000) @Matches(/data:image\/(png\|jpe?g\|webp);base64,/)` | Data URL PNG/JPEG/WebP (se sanea con `sharp` al guardar) |
| `amount` | string | sí | `@IsString` | Monto |
| `paymentDate` | Date | no | `@IsOptional` | Fecha de pago |

- **Respuesta**: `PaymentProofResponseDto`.
- **Efectos secundarios**: escribe `payment_proofs` (status `PENDING`).
- **Errores**: `403 ForbiddenException('Tenant context is required for this resource.')`, `404 NotFoundException` (suscripción no encontrada), `409 ConflictException` (`'Ya existe un comprobante pendiente de revisión para esta suscripción'`).

### GET /api/payment-settings/proof/subscription/:subscriptionId
- **Descripción**: Lista los comprobantes de una suscripción de la empresa.
- **Auth**: JWT. Requiere `user.companyId`.
- **Plan**: ninguno.
- **Guards extra**: ninguno explícito.
- **Path params**: `subscriptionId` (string).
- **Query / Body**: no aplica.
- **Respuesta**: array de `PaymentProofResponseDto`.
- **Efectos secundarios**: ninguno.
- **Errores**: `403` (sin tenant), `404` (suscripción no encontrada).

### GET /api/payment-settings/proof/pending
- **Descripción**: Lista global de comprobantes `PENDING`.
- **Auth**: JWT + `@Roles(GlobalRole.SUPER_ADMIN)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de `PaymentProofResponseDto`.
- **Efectos secundarios / Errores**: ninguno.

### PATCH /api/payment-settings/proof/:proofId/review
- **Descripción**: Revisa un comprobante. Si se aprueba, marca el último pago `PENDING` como `SUCCEEDED`, extiende la suscripción y activa la empresa.
- **Auth**: JWT + `@Roles(GlobalRole.SUPER_ADMIN)`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params**: `proofId` (string).
- **Query**: `userId` (string) — se usa como `reviewedBy`.
- **Body (DTO `ReviewPaymentProofDto`)**: `status` (`'APPROVED'`/`'REJECTED'`, `@IsEnum`), `notes?` (`@IsOptional @IsString`).
- **Respuesta**: `PaymentProofResponseDto` construido.
- **Efectos secundarios**: escribe `payment_proofs` (`status`, `reviewedBy`, `reviewedAt`, `notes`); si `APPROVED`: transacción que actualiza `payments` (`SUCCEEDED`, `paidAt`), `subscriptions` (`status='ACTIVE'`, nuevo `endDate`) y `companies.status='ACTIVE'`.
- **Errores**: `404 NotFoundException` (`'Comprobante no encontrado'`), `409 ConflictException` (`'El comprobante ya fue revisado'`).

### GET /api/payment-settings/proof/:proofId
- **Descripción**: Obtiene un comprobante. Admins globales (`SUPER_ADMIN`/`SUPPORT_ADMIN`) ven cualquiera; el resto solo de su empresa.
- **Auth**: JWT (el handler aplica `@UseGuards(JwtAuthGuard, RolesGuard)`; no exige `@Roles`).
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params**: `proofId` (string).
- **Query / Body**: no aplica.
- **Respuesta**: `PaymentProofResponseDto`.
- **Efectos secundarios**: ninguno.
- **Errores**: `404 NotFoundException` (`'Comprobante #<id> no encontrado'`) si no existe o no pertenece a la empresa.

---

## Funciones del servicio (`PaymentsService`)

### `findByCompany(companyId)`
- **Qué hace**: obtiene la suscripción más reciente con `payments` y devuelve sus pagos.
- **Escribe en**: no escribe.
- **Devuelve**: array de `Payment` (o `[]`).
- **Lanza**: nada explícito.

### `getPaymentHistory(companyId, page=1, limit=20)`
- **Qué hace**: paginación de pagos de la suscripción de la empresa.
- **Escribe en**: no escribe.
- **Devuelve**: `{ data, total, page, limit, totalPages }`.
- **Lanza**: nada explícito.

### `getCurrentPending(companyId)`
- **Qué hace**: pago `PENDING` más reciente de la suscripción.
- **Escribe en**: no escribe.
- **Devuelve**: `Payment` o `null`.
- **Lanza**: nada explícito.

### `uploadProofForPayment(paymentId, companyId, imageBase64, paymentDate?)`
- **Qué hace**: valida pago `PENDING`, valida y sanea la imagen (`parseImageDataUrl`) y crea un `PaymentProof`.
- **Escribe en**: `payment_proofs`.
- **Devuelve**: `PaymentProof`.
- **Lanza**: `NotFoundException('Pago no encontrado')`, `BadRequestException('Este pago ya fue procesado')`, `BadRequestException` (imagen inválida o demasiado grande).

### `findPendingByCompany(companyId)`
- **Qué hace**: pagos `PENDING` de la suscripción `ACTIVE`.
- **Escribe en**: no escribe.
- **Devuelve**: array de `Payment` (o `[]`).
- **Lanza**: nada explícito.

### `findOne(id, companyId)`
- **Qué hace**: obtiene un pago con su suscripción (`plan`, `company`) filtrando por empresa.
- **Escribe en**: no escribe.
- **Devuelve**: `Payment` con `subscription`.
- **Lanza**: `NotFoundException('Pago no encontrado')`.

### `generateReceipt(id, companyId)`
- **Qué hace**: construye un recibo (no persistido) con IGV 18% y fecha de vencimiento si está `PENDING`.
- **Escribe en**: no escribe.
- **Devuelve**: objeto recibo.
- **Lanza**: `NotFoundException` (vía `findOne`).

### `markAsPaid(id, companyId, paymentDate?)`
- **Qué hace**: valida `PENDING`, marca `SUCCEEDED`, extiende suscripción y activa empresa.
- **Escribe en**: `payments`, `subscriptions`, `companies`.
- **Devuelve**: pago actualizado + `{ message }`.
- **Lanza**: `BadRequestException('Este pago ya fue procesado')`, `NotFoundException('Pago no encontrado')`.

### `findAllPending(page=1, limit=20)`
- **Qué hace**: pagos `PENDING` globales con suscripción.
- **Escribe en**: no escribe.
- **Devuelve**: `{ data, total, page, limit, totalPages }`.
- **Lanza**: nada explícito.

### `getStats()`
- **Qué hace**: agrega pendientes/exitosos y recaudación del mes.
- **Escribe en**: no escribe.
- **Devuelve**: `{ pending, succeeded, monthlyRevenue }`.
- **Lanza**: nada explícito.

### `createCheckoutSession(input)`
- **Qué hace**: busca el plan y despacha a MercadoPago o respuestas simuladas de Yape/otros.
- **Escribe en**: no escribe.
- **Devuelve**: objeto de sesión según proveedor.
- **Lanza**: `Error('Plan not found')`.

### `createMercadoPagoCheckout(companyId, plan)` (privada)
- **Qué hace**: usa `require('mercadopago')` con `MERCADOPAGO_ACCESS_TOKEN`; crea un pago con `payment_method_id: 'yape'` y `notification_url` a `/payments/webhooks/mercadopago`.
- **Escribe en**: no escribe.
- **Devuelve**: sesión o error.
- **Lanza**: no lanza; captura errores y devuelve `status: 'error'`.

### `handleWebhook(provider, payload, headers, query)`
- **Qué hace**: para `mercadopago` verifica firma y activa la suscripción si `status==='approved'`.
- **Escribe en**: no escribe directamente (delega en `activateSubscription`).
- **Devuelve**: `{ provider, received: true, processed: true }`.
- **Lanza**: `UnauthorizedException` (firma).

### `verifyMercadoPagoSignature(headers, query)` (privada)
- **Qué hace**: valida `x-signature` (HMAC SHA256 con `MERCADOPAGO_WEBHOOK_SECRET`, manifiesto `<data.id>.<ts>`, ventana de 10 min).
- **Escribe en**: no escribe.
- **Devuelve**: `true`.
- **Lanza**: `UnauthorizedException` (secreto no configurado, firma ausente/expirada/inválida).

### `activateSubscription(companyId, planCode, transactionId?)` (privada)
- **Qué hace**: evita duplicados por `providerPaymentId`; hace upsert de `Subscription`, activa `Company` y crea `Payment` (manejo de `P2002`).
- **Escribe en**: `subscriptions`, `companies`, `payments`, `notifications`; envía email `payment-received`.
- **Devuelve**: nada.
- **Lanza**: errores de Prisma distintos de `P2002`.

## Funciones del servicio (`CheckoutRequestsService`)

### `createRequest(input)`
- **Qué hace**: valida proveedor offline; rama autenticada (empresa existente, reutiliza solicitud `DRAFT/SUBMITTED` del mismo plan) o rama pública (valida email libre, crea `User` no aún, hashea password, valida perfil para planes de pago).
- **Escribe en**: `checkout_requests`.
- **Devuelve**: respuesta de checkout.
- **Lanza**: `BadRequestException`, `NotFoundException`, `ConflictException` (ver endpoint).

### `submitProof(requestId, companyId, input)`
- **Qué hace**: valida y sanea la imagen (PNG/JPEG/WebP vía `parseImageDataUrl`), busca solicitud `DRAFT`, la pasa a `SUBMITTED` y envía email.
- **Escribe en**: `checkout_requests`; email `sendPaymentProofReceived`.
- **Devuelve**: `{ requestId, status: 'SUBMITTED' }`.
- **Lanza**: `BadRequestException`, `NotFoundException`, `ConflictException`.

### `getPending()`
- **Qué hace**: lista solicitudes `SUBMITTED` con campos seleccionados.
- **Escribe en**: no escribe.
- **Devuelve**: array.
- **Lanza**: nada explícito.

### `review(requestId, reviewerId, input)`
- **Qué hace**: rechaza o aprueba; deriva a aprobación de upgrade o de nuevo cliente.
- **Escribe en**: `checkout_requests` y según rama (`subscriptions`, `companies`, `payments`, `users`, `notifications`); emails.
- **Devuelve**: `{ requestId, status, subscriptionId?/companyId? }`.
- **Lanza**: `BadRequestException`, `NotFoundException`, `ConflictException`.

### `handleUpgradeApproval(...)` / `handleNewCustomerApproval(...)` (privadas)
- **Qué hace**: ejecutan la transacción de aprobación de upgrade o de alta de nuevo cliente, notifican y envían email.
- **Escribe en**: (upgrade) `checkout_requests`, `companies`, `subscriptions`, `payments`, `notifications`; (nuevo cliente) además `users` y memberships.
- **Devuelve**: `{ requestId, status, ... }`.
- **Lanza**: `BadRequestException`, `ConflictException`.

### `buildCheckoutResponse(...)` / `createOrReuse(...)` (privadas)
- **Qué hace**: arma la respuesta; `createOrReuse` reintenta ante `P2002` por `idempotencyKey`.
- **Devuelve**: objeto de respuesta / `{ request, existingSettings }`.
- **Lanza**: re-lanza errores distintos de `P2002`.

## Funciones del servicio (`PaymentSettingsService`)

### `getPublicSettings()`
- Lista pública (`select` de campos públicos). No escribe. Devuelve array.

### `getPublicSettingByProvider(provider)`
- Config pública por proveedor. No escribe. Devuelve setting o `null`.

### `getAllSettings()` / `getSettingsByProvider(provider)`
- Igual que las públicas pero sin `select` (todos los campos). No escribe. **Nota**: no están expuestas por el controlador.

### `updateSettings(provider, data)`
- Crea o actualiza la configuración del proveedor (`config` por defecto `{}`). Escribe `payment_settings`. Devuelve el setting.

### `getEnabledProvider(provider)`
- Busca el setting habilitado (`isEnabled: true`). No escribe. Devuelve setting o `null`. No expuesto por el controlador.

### `uploadPaymentProof(subscriptionId, data, companyId)`
- Valida suscripción de la empresa y ausencia de comprobante `PENDING` previo; crea `PaymentProof`. Lanza `NotFoundException` y `ConflictException`.

### `getProofsBySubscription(subscriptionId, companyId)`
- Lista comprobantes de la suscripción de la empresa. Lanza `NotFoundException`.

### `getPendingProofs()`
- Lista comprobantes `PENDING`. No escribe.

### `reviewProof(proofId, reviewerId, data)`
- Actualiza el comprobante; si `APPROVED` ejecuta transacción (`payments`, `subscriptions`, `companies`). Lanza `NotFoundException`, `ConflictException`.

### `getProofById(proofId, companyId?)`
- Devuelve el comprobante; si `companyId` es `undefined` (admin global) no filtra por empresa. Lanza `NotFoundException`.

## Observaciones
- No se aplica `@RequireModule/@RequireFeature` en este módulo.
- `markAsPaid` y las aprobaciones de upgrade no invalidan el cache `plan:caps:<companyId>`, a diferencia de `SubscriptionsService`.
- El webhook de MercadoPago activa la suscripción mediante `activateSubscription`, que no invalida cache de capacidades.
