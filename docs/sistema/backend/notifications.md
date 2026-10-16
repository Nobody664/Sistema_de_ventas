# Módulo: notifications

## Propósito
Gestiona las notificaciones persistidas en la tabla `notifications`: consulta por usuario y por empresa, conteo de no leídas, marcado como leídas y un canal SSE en memoria para push al cliente. Además, `NotificationsService.create` es el punto único de creación de notificaciones usado por otros módulos (billing, sales, low-stock, subscriptions, payments, company-profile, plan-upgrade-requests, checkout-requests).

## Archivos clave
- `backend/src/modules/notifications/notifications.controller.ts` — controller de `notifications`; expone consultas, marcado de lectura y el stream SSE.
- `backend/src/modules/notifications/notifications.service.ts` — `NotificationsService`; define los enums locales `NotificationType`/`NotificationChannel`, la interfaz `CreateNotificationInput` y la lógica de persistencia.
- `backend/src/modules/notifications/notifications.service.spec.ts` — pruebas de `markAsRead` (propiedad de la notificación).
- `backend/src/modules/notifications/notifications.module.ts` — declara controller y service; importa `PrismaModule` y exporta `NotificationsService`.

## Enums locales (definidos en el servicio)
- `NotificationType` (subconjunto del enum Prisma; solo estos valores aparecen en el archivo): `NEW_COMPANY_REGISTRATION`, `CHECKOUT_REQUEST_PENDING`, `PLAN_UPGRADE_REQUEST`, `PAYMENT_PROOF_PENDING`, `PAYMENT_RECEIVED`, `PAYMENT_FAILED`, `ACCOUNT_ACTIVATED`, `ACCOUNT_APPROVED`, `SUBSCRIPTION_PENDING`, `SUBSCRIPTION_APPROVED`, `SUBSCRIPTION_REJECTED`, `TRIAL_EXPIRING_SOON`, `TRIAL_EXPIRED`, `PLAN_UPGRADED`, `NEW_SALE`, `LOW_STOCK`, `NEW_CUSTOMER`, `SALE_COMPLETED`, `SALE_RETURNED`, `GENERAL`.
- `NotificationChannel`: `EMAIL`, `IN_APP`, `SMS` (el enum Prisma incluye además `WHATSAPP`).

## Endpoints

Todos los endpoints cuelgan del prefijo global `/api`. El controller aplica `@UseGuards(JwtAuthGuard)` a nivel de clase.

### GET /api/notifications/stream
- **Descripción**: Abre un stream SSE (`text/event-stream`) para el usuario autenticado. Mantiene un registro en memoria (`Map<userId, Set<send>>`) y escribe `data: <json>\n\n` cuando se le entrega una notificación.
- **Auth**: JWT (guard de clase).
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard` (clase).
- **Path params / Query / Body**: ninguno.
- **Respuesta**: stream SSE (headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`). No devuelve un cuerpo JSON.
- **Efectos secundarios**: manejador en memoria por `user.sub`; en `close` se desregistra el cliente. No escribe base de datos.
- **Errores**: 401 por JWT (guard global).
- **Nota**: el método público `emitNotification(userId, notification)` del controller empuja datos a los clientes suscritos, pero **no se encontraron llamadas a este método en el código** (queda como "no verificado en el código" que se use actualmente).

### GET /api/notifications
- **Descripción**: Lista las notificaciones del usuario autenticado.
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard` (clase).
- **Query**:
  - `unreadOnly` (string, opcional): si es exactamente `'true'`, filtra `isRead = false`.
- **Respuesta**: `Notification[]` (máximo 50, orden `createdAt desc`).
- **Efectos secundarios**: solo lectura.
- **Errores**: 401 por JWT.

### GET /api/notifications/company
- **Descripción**: Lista las notificaciones de la empresa (`tenantId` del JWT).
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Query**:
  - `unreadOnly` (string, opcional): `'true'` → `isRead = false`.
- **Respuesta**: `Notification[]` (máximo 50, orden `createdAt desc`).
- **Efectos secundarios**: solo lectura.
- **Errores**:
  - **403** de `TenantGuard` (sin `companyId`, o empresa `SUSPENDED`/`INACTIVE`/`PAST_DUE`).

### GET /api/notifications/unread-count
- **Descripción**: Devuelve el conteo de notificaciones no leídas del usuario.
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard` (clase).
- **Path params / Query / Body**: ninguno.
- **Respuesta**: `{ count: number }`.
- **Efectos secundarios**: solo lectura.
- **Errores**: 401 por JWT.

### PATCH /api/notifications/:id/read
- **Descripción**: Marca como leída una notificación del usuario autenticado.
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard` (clase).
- **Path params**:
  - `id` (string, requerido): id de la notificación.
- **Body**: ninguno. (Cabecera `Content-Type: application/json` requerida por el `CsrfGuard` en mutaciones.)
- **Respuesta**: la `Notification` actualizada (`isRead = true`).
- **Efectos secundarios**: escribe `notifications.isRead`.
- **Errores**:
  - **404** `Notification not found` si no existe una notificación con ese `id` y `userId`.
  - **403** CSRF si falta `Content-Type: application/json`.

### PATCH /api/notifications/read-all
- **Descripción**: Marca como leídas todas las notificaciones no leídas del usuario.
- **Auth**: JWT.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard` (clase).
- **Path params / Query / Body**: ninguno.
- **Respuesta**: resultado de `updateMany` (Prisma `BatchPayload`, p. ej. `{ count }`).
- **Efectos secundarios**: escribe `notifications.isRead` de todas las no leídas del usuario.
- **Errores**: 403 CSRF si falta `Content-Type: application/json`.

## Creación de notificaciones (uso por otros módulos)

`NotificationsService.create(input: CreateNotificationInput)` es el método compartido. El módulo exporta el service, por lo que otros módulos lo inyectan (p. ej. `BillingService`, `LowStockService`, `SubscriptionsService`, `PaymentsService`, `CompanyProfileService`, `PlanUpgradeRequestsService`, `CheckoutRequestsService`).

Interfaz de entrada:
- `userId: string` (requerido), `companyId?: string`, `type: string`, `channel?: string` (por defecto `IN_APP`), `title: string`, `message: string`, `data?: Record<string, unknown>`.
- Al crear, `sentAt` se sella con la fecha actual solo si `channel === EMAIL`; en caso contrario queda `null`.

Ejemplos observados en el código:
- `billing.service.ts`: `type: 'PAYMENT'`, `channel: 'IN_APP'`, título "Pago próximo a vencer" / "Suscripción vencida" (destinatario: primer `membership` de la empresa).
- `low-stock.service.ts`: `type: NotificationType.LOW_STOCK` (sin `channel`, por lo que es `IN_APP`), con `data: { productId, stockQuantity, minStock }`, en bucle por usuario destinatario.
- `payments.service.ts`, `subscriptions.service.ts`, `plan-upgrade-requests.service.ts`, `checkout-requests.service.ts` y `company-profile.service.ts` también invocan `create` (se verificó el uso; el detalle exacto de cada llamada no se documenta aquí).

## Funciones del servicio (`NotificationsService`)

### `create(input: CreateNotificationInput)`
- **Qué hace**: Inserta una `Notification` con `type`/`channel` (por defecto `IN_APP`), `data` (por defecto `{}`) y `sentAt` (fecha solo si el canal es `EMAIL`).
- **Escribe en**: `notifications`.
- **Devuelve**: la notificación creada.
- **Lanza**: no lanza excepciones propias.

### `findByUser(userId: string, options?: { unreadOnly?: boolean; limit?: number })`
- **Qué hace**: Lista notificaciones del usuario; opcionalmente solo no leídas; orden `createdAt desc`, `take` = `limit` o 50.
- **Lee de**: `notifications`.
- **Devuelve**: `Notification[]`.
- **Lanza**: no lanza excepciones propias.

### `findByCompany(companyId: string, options?: { unreadOnly?: boolean; limit?: number })`
- **Qué hace**: Igual que `findByUser` pero filtrando por `companyId`.
- **Lee de**: `notifications`.
- **Devuelve**: `Notification[]`.
- **Lanza**: no lanza excepciones propias.

### `markAsRead(id: string, userId: string)`
- **Qué hace**: Verifica con `findFirst({ id, userId })` que la notificación pertenece al usuario y luego la actualiza a `isRead = true`.
- **Lee de**: `notifications`.
- **Escribe en**: `notifications.isRead`.
- **Devuelve**: la notificación actualizada.
- **Lanza**: `NotFoundException('Notification not found')` si no existe la notificación para ese usuario.

### `markAllAsRead(userId: string)`
- **Qué hace**: `updateMany` sobre las notificaciones no leídas del usuario.
- **Escribe en**: `notifications.isRead`.
- **Devuelve**: resultado de `updateMany` (Prisma `BatchPayload`).
- **Lanza**: no lanza excepciones propias.

### `getUnreadCount(userId: string)`
- **Qué hace**: Cuenta las notificaciones no leídas del usuario.
- **Lee de**: `notifications`.
- **Devuelve**: `number`.
- **Lanza**: no lanza excepciones propias.

### `delete(id: string, userId: string)`
- **Qué hace**: Verifica propiedad con `findFirst({ id, userId })` y elimina la notificación.
- **Efectos**: elimina de `notifications`.
- **Devuelve**: la notificación eliminada.
- **Lanza**: `NotFoundException('Notification not found')` si no pertenece al usuario.
- **Nota**: el controller **no** expone un endpoint de borrado (método sin ruta asociada en el código).

## Pruebas (`notifications.service.spec.ts`)
Verifican la propiedad en `markAsRead`:
- Devuelve **404** (`NotFoundException`) cuando la notificación es de otro usuario (`findFirst` → `null`).
- Marca como leída solo una notificación cuyo `findFirst({ id, userId })` coincide, y el `update` se ejecuta con `{ id }`.
