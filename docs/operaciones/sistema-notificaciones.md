# Sistema de Notificaciones

## Resumen

Sistema completo de notificaciones para todos los roles del sistema SaaS de ventas.

---
 
## Roles y Notificaciones

### SUPER_ADMIN

| Tipo | Título | Mensaje | Acción (Click) |
|------|--------|---------|----------------|
| `NEW_COMPANY_REGISTRATION` | Nueva empresa registrada | "Nueva empresa: {nombre}" | → /companies |
| `CHECKOUT_REQUEST_PENDING` | Solicitud de cuenta pendiente | "Nueva solicitud de registro" | → /upgrade-requests |
| `PLAN_UPGRADE_REQUEST` | Solicitud de upgrade | "{empresa} solicitó upgrade a {plan}" | → /upgrade-requests |
| `PAYMENT_RECEIVED` | Pago recibido | "Pago de S/ {monto} recibido" | → /payment-settings |
| `PAYMENT_PROOF_PENDING` | Comprobante pendiente | "Nuevo comprobante de {empresa}" | → /upgrade-requests |

### COMPANY_ADMIN

| Tipo | Título | Mensaje | Acción (Click) |
|------|--------|---------|----------------|
| `ACCOUNT_APPROVED` | Cuenta aprobada | "Tu cuenta ha sido aprobada" | → /dashboard |
| `SUBSCRIPTION_APPROVED` | Plan aprobado | "Tu cambio al plan {plan} fue aprobado" | → /subscription |
| `SUBSCRIPTION_REJECTED` | Solicitud rechazada | "Tu solicitud fue rechazada" | → /subscription |
| `TRIAL_EXPIRING_SOON` | Prueba por vencer | "Tu período de prueba termina en {días} días" | → /subscription |
| `TRIAL_EXPIRED` | Prueba vencida | "Tu período de prueba terminó" | → /subscription |
| `PAYMENT_RECEIVED` | Pago confirmado | "Tu pago de S/ {monto} fue confirmado" | → /subscription |
| `PAYMENT_FAILED` | Pago fallido | "Tu pago no pudo ser procesado" | → /checkout |

### MANAGER

| Tipo | Título | Mensaje | Acción (Click) |
|------|--------|---------|----------------|
| `NEW_SALE` | Nueva venta | "Nueva venta de S/ {monto}" | → /sales |
| `LOW_STOCK` | Stock bajo | "Producto {nombre} con stock bajo" | → /products |
| `NEW_CUSTOMER` | Nuevo cliente | "Nuevo cliente registrado: {nombre}" | → /customers |

### CASHIER

| Tipo | Título | Mensaje | Acción (Click) |
|------|--------|---------|----------------|
| `SALE_COMPLETED` | Venta completada | "Venta #{id} completada" | → /sales |
| `SALE_RETURNED` | Venta devuelta | "Venta #{id} fue devuelta" | → /sales |

---

## Tipos de Notificación (Enum)

```typescript
export enum NotificationType {
  // SUPER_ADMIN
  NEW_COMPANY_REGISTRATION = 'NEW_COMPANY_REGISTRATION',
  CHECKOUT_REQUEST_PENDING = 'CHECKOUT_REQUEST_PENDING',
  PLAN_UPGRADE_REQUEST = 'PLAN_UPGRADE_REQUEST',
  PAYMENT_PROOF_PENDING = 'PAYMENT_PROOF_PENDING',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',

  // COMPANY_ADMIN
  ACCOUNT_APPROVED = 'ACCOUNT_APPROVED',
  SUBSCRIPTION_APPROVED = 'SUBSCRIPTION_APPROVED',
  SUBSCRIPTION_REJECTED = 'SUBSCRIPTION_REJECTED',
  TRIAL_EXPIRING_SOON = 'TRIAL_EXPIRING_SOON',
  TRIAL_EXPIRED = 'TRIAL_EXPIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PLAN_UPGRADED = 'PLAN_UPGRADED',

  // MANAGER / CASHIER
  NEW_SALE = 'NEW_SALE',
  LOW_STOCK = 'LOW_STOCK',
  NEW_CUSTOMER = 'NEW_CUSTOMER',
  SALE_COMPLETED = 'SALE_COMPLETED',
  SALE_RETURNED = 'SALE_RETURNED',

  // GENERAL
  GENERAL = 'GENERAL',
}
```

---

## Navegación por Notificación

```typescript
const notificationRoutes: Record<string, string> = {
  NEW_COMPANY_REGISTRATION: '/companies',
  CHECKOUT_REQUEST_PENDING: '/upgrade-requests',
  PLAN_UPGRADE_REQUEST: '/upgrade-requests',
  PAYMENT_PROOF_PENDING: '/upgrade-requests',
  PAYMENT_RECEIVED: '/subscription',
  ACCOUNT_APPROVED: '/dashboard',
  SUBSCRIPTION_APPROVED: '/subscription',
  SUBSCRIPTION_REJECTED: '/subscription',
  TRIAL_EXPIRING_SOON: '/subscription',
  TRIAL_EXPIRED: '/subscription',
  PAYMENT_FAILED: '/checkout',
  PLAN_UPGRADED: '/subscription',
  NEW_SALE: '/sales',
  LOW_STOCK: '/products',
  NEW_CUSTOMER: '/customers',
  SALE_COMPLETED: '/sales',
  SALE_RETURNED: '/sales',
  GENERAL: '/notifications',
};
```

---

## API Endpoints

```
GET    /notifications                    - Lista notificaciones del usuario
GET    /notifications/unread-count        - Cantidad no leídas
PATCH  /notifications/:id/read            - Marcar como leída
PATCH  /notifications/read-all            - Marcar todas como leídas
GET    /notifications/stream              - SSE para tiempo real (webhook)
POST   /notifications/webhook            - Webhook para notificaciones externas
```

---

## Tiempo Real (SSE)

### Conexión
```
GET /api/notifications/stream
Authorization: Bearer {token}
```

### Evento recibido
```json
{
  "id": "notif_xxx",
  "type": "PLAN_UPGRADE_REQUEST",
  "title": "Nueva solicitud de upgrade",
  "message": "Empresa X solicitó upgrade a Growth",
  "data": { "companyId": "xxx", "planCode": "GROWTH" },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

## Implementación

### Crear notificación
```typescript
await notificationsService.create({
  userId: 'user_xxx',
  companyId: 'company_xxx',
  type: NotificationType.PLAN_UPGRADE_REQUEST,
  title: 'Nueva solicitud de upgrade',
  message: 'Empresa X solicitó upgrade a Growth',
  data: { companyId, planCode, requestId },
  channel: NotificationChannel.IN_APP,
});
```

### Notificar a múltiples usuarios por rol
```typescript
async notifyAdmins(type: NotificationType, message: string, data: any) {
  const admins = await this.prisma.user.findMany({
    where: { globalRole: 'SUPER_ADMIN' }
  });
  
  for (const admin of admins) {
    await this.create({...});
  }
}
```

---

## Base de Datos

```prisma
model Notification {
  id          String              @id @default(cuid())
  userId      String
  companyId   String?
  type        NotificationType
  channel     NotificationChannel @default(IN_APP)
  title       String
  message     String
  data        Json?
  isRead      Boolean             @default(false)
  sentAt      DateTime?
  createdAt   DateTime            @default(now())

  @@index([userId, isRead])
  @@index([companyId, createdAt])
}

enum NotificationType {
  NEW_COMPANY_REGISTRATION
  CHECKOUT_REQUEST_PENDING
  PLAN_UPGRADE_REQUEST
  PAYMENT_PROOF_PENDING
  PAYMENT_RECEIVED
  ACCOUNT_APPROVED
  SUBSCRIPTION_APPROVED
  SUBSCRIPTION_REJECTED
  TRIAL_EXPIRING_SOON
  TRIAL_EXPIRED
  PAYMENT_FAILED
  PLAN_UPGRADED
  NEW_SALE
  LOW_STOCK
  NEW_CUSTOMER
  SALE_COMPLETED
  SALE_RETURNED
  GENERAL
}
```

---

## Frontend - Campanita

### Comportamiento
1. Muestra contador de notificaciones no leídas
2. Al hacer click → Navega a /notifications
3. Indicador de conexión en tiempo real (punto verde)

### Notificaciones en tiempo real
- Usa Server-Sent Events (SSE)
- Reconexión automática
- Badge con contador en tiempo real
