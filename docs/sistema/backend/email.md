# Módulo: email

## Propósito
Envío de correos transaccionales mediante SMTP (nodemailer) con plantillas de texto predefinidas y helpers por tipo de evento. El módulo **no tiene controller**; se expone como `EmailService` inyectable y, opcionalmente, un procesador BullMQ (`EmailProcessor`).

## Archivos clave
- `backend/src/modules/email/email.service.ts` — `EmailService`; configuración SMTP, `EmailTemplate`, interpolación y métodos de envío.
- `backend/src/modules/email/email.processor.ts` — `EmailProcessor`, worker BullMQ de la cola `email` (stub: registra y no envía).
- `backend/src/modules/email/email.module.ts` — registra el service; solo añade la cola y el processor si existe `REDIS_URL`.

## Controller
No hay controller en este módulo (no verificado en el código ningún `*.controller.ts`). El envío se realiza llamando a `EmailService` desde otros módulos (`auth`, `billing`, `subscriptions`, `payments`, `plan-upgrade-requests`, `checkout-requests`).

## Plantillas (`EmailTemplate`)
Valores y asuntos definidos en `EMAIL_TEMPLATES`:
- `subscription-pending` — "Tu cuenta está pendiente de aprobación".
- `subscription-approved` — "Tu suscripción ha sido aprobada".
- `subscription-rejected` — "Tu solicitud de suscripción ha sido rechazada".
- `account-activated` — "Tu cuenta ha sido activada".
- `payment-received` — "Pago recibido".
- `payment-proof-received` — "Comprobante recibido" (usa `{{companyName}}` y `{{planName}}`).
- `password-reset` — "Restablece tu contraseña" (usa `{{resetUrl}}`, indica validez de 15 minutos).
- `welcome` — "Bienvenido a Ventas SaaS".

La interpolación reemplaza `{{clave}}` por el valor de `data[clave]`, saneando caracteres de control y saltos de línea. El asunto y el cuerpo se pueden sobreescribir con `job.subject` si se provee.

## Configuración (variables de entorno)
Leídas en el constructor vía `ConfigService`:
- `SMTP_HOST` (def. `smtp.gmail.com`), `SMTP_PORT` (def. `587`).
- `secure` se activa solo cuando el puerto resuelto es `465`.
- Auth: `SMTP_USER` / `SMTP_PASSWORD`.
- Remitente: `SMTP_FROM_EMAIL` (def. `noreply@ventassaas.com`).
- `SMTP_ENABLED` (def. `false`): si es falso, `sendEmailDirect` no envía y solo registra en log `[DEMO]`.

## `EmailProcessor` (BullMQ)
- Decorador: `@Processor('email', { concurrency: 5 })`, extiende `WorkerHost`.
- `process(job)`: lee `job.data.to`, registra el dominio del destinatario y espera 100 ms. **No envía correo ni persiste nada.**
- `@OnWorkerEvent('completed')` / `@OnWorkerEvent('failed')`: registran el resultado del job.
- **No se encontró en el código ningún `.add()`/`InjectQueue` que alimente la cola `email`**, por lo que el processor no se usa actualmente para enviar (queda como "no verificado en el código" que se encole trabajo).

## `EmailModule`
- Importa `BullModule.registerQueue({ name: 'email' })` y agrega `EmailProcessor` a los providers **solo si** `!!process.env.REDIS_URL`.
- `EmailService` siempre se provee y se exporta; `EmailProcessor` no se exporta.

## Funciones del servicio (`EmailService`)

### `sendEmail(job: SendEmailJob): Promise<void>`
- **Qué hace**: Resuelve la plantilla, valida el destinatario, interpola el texto/asunto y **envía directamente** con el transporter SMTP. A pesar del log `Email queued` y del comentario "Direct send (no queue)", no encola en BullMQ.
- **Efectos**: envía un email SMTP; escribe logs. No escribe base de datos.
- **Devuelve**: `Promise<void>`.
- **Lanza**: si `sendMail` falla, propaga el error (no hay try-catch en este método). Si la plantilla es desconocida o el destinatario es inválido, solo registra un warning y retorna.

### `sendEmailDirect(job: SendEmailJob): Promise<void>`
- **Qué hace**: Igual que `sendEmail`, pero respeta `SMTP_ENABLED`: si está deshabilitado, registra `[DEMO] Email omitido` y retorna sin enviar.
- **Efectos**: envía email SMTP (si habilitado); logs.
- **Devuelve**: `Promise<void>`.
- **Lanza**: relanza el error de `sendMail` (con log previo `Error enviando email ...`).

### Helpers de envío (todos delegan en `sendEmailDirect`)
- `sendSubscriptionPending(userEmail, companyName)` — plantilla `subscription-pending`.
- `sendSubscriptionApproved(userEmail, companyName)` — plantilla `subscription-approved`.
- `sendSubscriptionRejected(userEmail, companyName)` — plantilla `subscription-rejected`.
- `sendAccountActivated(userEmail, companyName)` — plantilla `account-activated`.
- `sendPasswordReset(userEmail, resetUrl)` — plantilla `password-reset`; `data: { resetUrl }`.
- `sendPaymentProofReceived(userEmail, companyName, planName)` — plantilla `payment-proof-received`; `data: { companyName, planName }`.
- `sendTrialExpiringSoon(userEmail, companyName, planName, daysLeft)` — usa la plantilla `welcome` con asunto personalizado `"Tu período de prueba termina en <daysLeft> día(s)"`.
- `sendTrialExpired(userEmail, companyName, planName)` — usa la plantilla `welcome` con asunto `"Tu período de prueba ha expirado"`.
- **No existe** un helper dedicado para la plantilla `payment-received` (aunque la plantilla y los envíos desde otros módulos puedan referenciarla).

### Utilidades privadas
- `hasInvalidRecipient(to)`: rechaza destinatarios con `\r`, `\n`, `\u2028` o `\u2029` (mitiga inyección de cabeceras); retorna `true`/`false`.
- `interpolateTemplate(text, data)`: reemplaza `{{clave}}` y sanea el valor (elimina caracteres de control y saltos); recorta el resultado.
- `recipientDomain(to)`: extrae el dominio tras `@` para logging.

## Tipos
- `SendEmailJob = { to: string; subject: string; template: EmailTemplate; data: Record<string, unknown> }`.
- `EmailJobData` (solo en el processor) = `{ to, from, subject, text, html? }`.

## Errores
- No define excepciones HTTP propias (no hay capa HTTP). Los fallos de envío se propagan como errores; los casos de plantilla desconocida o destinatario inválido se ignoran con warning.
