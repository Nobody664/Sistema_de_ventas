# Módulo: email

## Propósito
Envío de correos transaccionales mediante SMTP (nodemailer) con plantillas de texto predefinidas y helpers por tipo de evento. El módulo **no tiene controller**; se expone como `EmailService` inyectable. Si existe `REDIS_URL`, los envíos pasan por la cola BullMQ `email`; sin Redis se envían de forma síncrona (fallback).

## Archivos clave
- `backend/src/modules/email/email.service.ts` — `EmailService`; SMTP, `EmailTemplate`, interpolación, `sendEmail` (cola/fallback) y `sendEmailDirect` (envío real).
- `backend/src/modules/email/email.processor.ts` — `EmailProcessor` (`WorkerHost`) de la cola `email`; delega en `sendEmailDirect`.
- `backend/src/modules/email/email.constants.ts` — `EMAIL_QUEUE = 'email'`, `EMAIL_JOB_SEND = 'send'`.
- `backend/src/modules/email/email.module.ts` — registra el service; solo añade `registerQueue` + `EmailProcessor` si existe `REDIS_URL`.
- `backend/src/modules/email/email.processor.spec.ts` — pruebas del processor (delegación y propagación de errores).

## Controller
No hay controller en este módulo. El envío se realiza llamando a `EmailService` desde otros módulos (`auth`, `billing`, `subscriptions`, `payments`, `plan-upgrade-requests`, `checkout-requests`).

## Plantillas (`EmailTemplate`)
- `subscription-pending` — "Tu cuenta está pendiente de aprobación".
- `subscription-approved` — "Tu suscripción ha sido aprobada" (incluye `{{signInUrl}}`).
- `subscription-rejected` — "Tu solicitud de suscripción ha sido rechazada".
- `account-activated` — "Tu cuenta ha sido activada" (incluye `{{signInUrl}}`).
- `payment-received` — "Pago recibido".
- `payment-proof-received` — "Comprobante recibido" (`{{companyName}}`, `{{planName}}`).
- `password-reset` — "Restablece tu contraseña" (`{{resetUrl}}`, 15 minutos de validez).
- `welcome` — "Bienvenido a Huanka-Saas".
- `trial-expiring-soon` — "Tu período de prueba está por terminar" (`{{message}}` + `{{signInUrl}}`).
- `trial-expired` — "Tu período de prueba ha expirado" (`{{message}}` + `{{signInUrl}}`).

La interpolación reemplaza `{{clave}}` con `data[clave]`, saneando caracteres de control y saltos de línea. `withCommonData()` inyecta siempre `signInUrl = ${FRONTEND_URL}/sign-in`. El asunto del template puede sobreescribirse con `job.subject`.

## Configuración (variables de entorno)
- `SMTP_HOST` (def. `smtp.gmail.com`), `SMTP_PORT` (def. `587`); `secure` solo con puerto `465`.
- Auth: `SMTP_USER` / `SMTP_PASSWORD`; remitente `SMTP_FROM_EMAIL` (def. `noreply@ventassaas.com`).
- `SMTP_ENABLED` (def. `false`): si es falso, `sendEmailDirect` no envía y solo registra `[DEMO]`.
- `FRONTEND_URL` (def. `http://localhost:3000`): base de `{{signInUrl}}`.
- `REDIS_URL`: activa la cola BullMQ `email` (sin él, envío síncrono).

## Cola BullMQ
- `sendEmail(job)` hace `queue.add('send', job, { attempts: 3, backoff: exponential 5s, removeOnComplete: 200, removeOnFail: 500 })`.
- Si la cola no está disponible o `add()` falla, se registra el error y se reintenta **síncrono** con `sendEmailDirect`.
- `EmailProcessor.process(job)` llama a `sendEmailDirect(job.data)`; el error SMTP se propaga para que BullMQ aplique reintentos.
- `EmailModule` registra la cola y el processor **solo si** `!!process.env.REDIS_URL`.

## Funciones del servicio (`EmailService`)

### `sendEmail(job: SendEmailJob): Promise<void>`
- **Qué hace**: encola el envío en BullMQ si hay Redis; si no, delega en `sendEmailDirect`.
- **Efectos**: crea un job en la cola `email` o envía SMTP directamente.
- **Devuelve**: `Promise<void>`.
- **Lanza**: no propaga el fallo de `queue.add` (hace fallback síncrono); el fallback sí puede lanzar errores SMTP.

### `sendEmailDirect(job: SendEmailJob): Promise<void>`
- **Qué hace**: resuelve plantilla, valida destinatario, interpola y envía con el transporter; respeta `SMTP_ENABLED`.
- **Efectos**: envía email SMTP (si habilitado); logs. No escribe base de datos.
- **Devuelve**: `Promise<void>`.
- **Lanza**: relanza el error de `sendMail` (con log previo `Error enviando email ...`). Plantilla desconocida o destinatario inválido → warning y retorno.

### Helpers de envío (todos delegan en `sendEmail`, es decir pasan por la cola)
- `sendSubscriptionPending(userEmail, companyName)` — plantilla `subscription-pending`.
- `sendSubscriptionApproved(userEmail, companyName)` — plantilla `subscription-approved`.
- `sendSubscriptionRejected(userEmail, companyName)` — plantilla `subscription-rejected`.
- `sendAccountActivated(userEmail, companyName)` — plantilla `account-activated`.
- `sendPasswordReset(userEmail, resetUrl)` — plantilla `password-reset`.
- `sendPaymentProofReceived(userEmail, companyName, planName)` — plantilla `payment-proof-received`.
- `sendTrialExpiringSoon(userEmail, companyName, planName, daysLeft)` — plantilla `trial-expiring-soon` con `{{message}}`.
- `sendTrialExpired(userEmail, companyName, planName)` — plantilla `trial-expired` con `{{message}}`.

### Utilidades privadas
- `hasInvalidRecipient(to)`: rechaza destinatarios con `\r`, `\n`, `\u2028` o `\u2029`.
- `interpolateTemplate(text, data)`: reemplaza `{{clave}}` y sanea el valor; recorta el resultado.
- `withCommonData(data)`: añade `signInUrl` desde `FRONTEND_URL`.
- `recipientDomain(to)`: extrae el dominio tras `@` para logging.

## Tipos
- `SendEmailJob = { to: string; subject: string; template: EmailTemplate; data: Record<string, unknown> }`.

## Errores
- No define excepciones HTTP propias. Los fallos de envío se propagan como errores (y BullMQ reintenta); plantilla desconocida o destinatario inválido se ignoran con warning.
