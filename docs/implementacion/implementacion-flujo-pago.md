# Implementación: Checkout Offline (Comprobante) y Payment Settings

**Fecha:** 13 de marzo de 2026

## Objetivo

Implementar el flujo de `/checkout?plan=GROWTH` (y otros planes) para pagos offline (Yape/Plin/Transferencia) con estas reglas:

1. El usuario puede **subir una imagen** (comprobante) y **confirmar** el pago.
2. **No** se crea `Company`/`User`/`Subscription` al enviar el formulario.
3. El **correo** que incluye **nombre de empresa y plan** se envía **recién cuando el usuario confirma el pago** (sube el comprobante).
4. La creación real de la cuenta queda sujeta a revisión `SUPER_ADMIN` (evita saltarse pasos).

## Flujo (alto nivel)

1. Usuario completa el formulario en `/checkout?plan=...` y selecciona método offline.
2. Frontend crea una `CheckoutRequest` (estado `DRAFT`) en backend.
   - Backend valida `planCode` y que el método esté habilitado en `PaymentSettings`.
3. Frontend muestra datos de pago (QR/cuenta) y UI de upload.
4. Usuario sube comprobante y presiona `Confirmar pago`.
   - Backend guarda el comprobante, marca la solicitud como `SUBMITTED` y envía email `Comprobante recibido` con `companyName` y `planName`.
5. `SUPER_ADMIN` revisa solicitudes pendientes.
   - En `APPROVED` se crean `Company`, `User`, `Subscription`, `Payment` y se envía email de aprobación.
   - En `REJECTED` se marca la solicitud como rechazada y se notifica por correo.

## Backend (NestJS)

Todas las rutas asumen el prefijo global `API_PREFIX` (por defecto `api`), por ejemplo:

- `POST /api/payments/checkout/requests`

### Modelos Prisma

- `PaymentSettings`: configuración por `PaymentProvider` (QR/cuenta/instrucciones).
- `CheckoutRequest`: almacena los datos del formulario y el comprobante hasta revisión.
- Al aprobar: se crean `Company`, `User`, `Subscription`, `Payment`.

Referencia: `backend/prisma/schema.prisma`.

### Endpoints

**Payment Settings** (`backend/src/modules/payments/payment-settings.controller.ts`):

- `GET /payments/settings` (`@Public()`): lista settings.
- `GET /payments/settings/provider/:provider` (`@Public()`): settings por proveedor.
- `PATCH /payments/settings/provider/:provider` (`SUPER_ADMIN`): actualizar settings.

**Checkout Requests** (`backend/src/modules/payments/checkout-requests.controller.ts`):

- `POST /payments/checkout/requests` (`@Public()`): crea `CheckoutRequest` en `DRAFT`.
- `POST /payments/checkout/requests/:requestId/proof` (`@Public()`): guarda comprobante y marca `SUBMITTED`.
- `GET /payments/checkout/requests/pending` (`SUPER_ADMIN`): lista solicitudes `SUBMITTED`.
- `PATCH /payments/checkout/requests/:requestId/review` (`SUPER_ADMIN`): `APPROVED` o `REJECTED`.

### Validaciones (control de filtros)

Implementadas en `backend/src/modules/payments/checkout-requests.service.ts`:

- `planCode` debe existir.
- `paymentMethod` debe ser `YAPE`, `PLIN` o `TRANSFER`.
- El método debe estar `isEnabled=true` en `PaymentSettings`.
- No se permite crear una solicitud si el email ya existe como `User`.
- El comprobante debe ser `data:image/...`.

### Registro (anti-bypass)

`POST /auth/register` ya **no** acepta `planCode`/`paymentMethod` para evitar registrar empresas antes del comprobante.

Archivo: `backend/src/modules/auth/auth.service.ts`.

### Tamaño de body

El upload base64 requiere límite JSON > 100kb. Se configura:

- `backend/src/main.ts` con `json({ limit: '2mb' })`.

## Frontend (Next.js)

### Checkout

Archivo: `frontend/app/checkout/page.tsx`.

Rutas consumidas:

- `GET /payments/settings` para mostrar métodos habilitados.
- `POST /payments/checkout/requests` para crear solicitud.
- `POST /payments/checkout/requests/:requestId/proof` para confirmar pago con comprobante.

### Settings de pagos

Archivo: `frontend/components/settings/payment-settings.tsx`.

## Emails

Archivo: `backend/src/modules/email/email.service.ts`.

- Se agrega el template `payment-proof-received` y se envía al confirmar el comprobante.

## Pasos de ejecución (DB)

1. Actualizar schema y generar cliente:
   - `npm run prisma:generate` (backend)
2. Aplicar cambios de DB:
   - `npm run db:push` o `npm run prisma:migrate` (según tu estrategia)

## Checklist de verificación rápida

1. Habilitar Yape/Plin/Transferencia en Settings y guardar QR/cuenta.
2. Ir a `/checkout?plan=GROWTH` y enviar formulario.
   - Debe crear `CheckoutRequest` en `DRAFT`.
3. Subir comprobante y confirmar.
   - Debe marcar `CheckoutRequest` en `SUBMITTED` y enviar email `Comprobante recibido`.
4. Como `SUPER_ADMIN`, listar pendientes y aprobar.
   - Debe crear `Company`/`User`/`Subscription`/`Payment` y enviar email de aprobación.
