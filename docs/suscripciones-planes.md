# Sistema de Planes y Suscripciones

## Resumen

Módulo completo para gestión de planes SaaS, suscripciones y flujo de pago desde landing page hasta aprobación administrativa.

## Arquitectura

### Modelos de Base de Datos

```prisma
Plan          → Subscription → Payment
   ↓                  ↓            ↓
 Pricing          Company      Transaction
```

### Flujo de Usuario

```
/pricing → [selecciona plan] → /checkout
                                  ↓
                            [registro + plan]
                                  ↓
                            [pago simulado]
                                  ↓
                            TRIALING (pendiente)
                                  ↓
                    SUPER_ADMIN approve → ACTIVE
```

## Roles y Permisos

| Rol | Ver Suscriptores | Aprobar | Rechazar | Cambiar Plan |
|-----|-----------------|---------|----------|--------------|
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ |
| SUPPORT_ADMIN | ✅ | ❌ | ❌ | ❌ |
| COMPANY_ADMIN | ❌ | ❌ | ❌ | ✅ (propio) |

## Endpoints

### Auth - Registro con Plan
```http
POST /api/auth/register
{
  "fullName": "Juan Pérez",
  "companyName": "Mi Tienda",
  "email": "juan@ejemplo.com",
  "password": "12345678",
  "planCode": "GROWTH",        // opcional
  "paymentMethod": "yape"      // opcional
}
```

### Suscripciones
```http
# Ver suscripción actual ( COMPANY_ADMIN )
GET /api/subscriptions/current

# Mejorar plan ( COMPANY_ADMIN )
POST /api/subscriptions/upgrade
{ "planCode": "SCALE", "billingCycle": "MONTHLY" }

# Cancelar suscripción ( COMPANY_ADMIN )
POST /api/subscriptions/cancel

# Listar suscriptores ( SUPER_ADMIN )
GET /api/subscriptions/subscribers

# Aprobar suscriptor ( SUPER_ADMIN )
PATCH /api/subscriptions/subscribers/:id/approve

# Rechazar suscriptor ( SUPER_ADMIN )
PATCH /api/subscriptions/subscribers/:id/reject

# Estadísticas ( SUPER_ADMIN )
GET /api/subscriptions/stats
```

## Reglas de Negocio

### 1. Registro con Plan
- Al registrar con `planCode`, se crea automáticamente:
  - Company con estado inicial
  - Subscription con estado `TRIALING`
  - Payment pendiente (demo)
- El usuario no puede acceder hasta ser aprobado

### 2. Estados de Suscripción

| Estado | Descripción | Acceso al Sistema |
|--------|-------------|-------------------|
| TRIALING | Período de prueba | ❌ (requiere aprobación) |
| ACTIVE | Aprobado y activo | ✅ |
| PAST_DUE | Pago vencido | ⚠️ (limitado) |
| CANCELED | Cancelado | ❌ |
| EXPIRED | Expirado | ❌ |

### 3. Estados de Empresa

| Estado | Descripción |
|--------|-------------|
| TRIAL | En período de prueba |
| ACTIVE | Operación normal |
| SUSPENDED | Suspendida por impago o rechazo |
| PAST_DUE | Con deuda |

### 4. Mejora de Plan
- Solo COMPANY_ADMIN puede mejorar su propio plan
- El cambio es inmediato
- Se genera nuevo Payment pendiente
- No hay prorrateo en versión demo

### 5. Aprobación de Suscriptores
- Solo SUPER_ADMIN puede aprobar
- Al aprobar: Subscription → ACTIVE, Company → ACTIVE
- Al rechazar: Subscription → CANCELED, Company → SUSPENDED

## Planes Existentes

| Código | Nombre | Precio Mensual | Precio Anual | Límites |
|--------|--------|----------------|--------------|---------|
| START | Start | S/ 19 | S/ 190 | 3 usuarios, 500 productos |
| GROWTH | Growth | S/ 59 | S/ 590 | 15 usuarios, 10,000 productos |
| SCALE | Scale | S/ 149 | S/ 1,490 | Ilimitado |

## Frontend

### Páginas

| Ruta | Rol | Descripción |
|------|-----|-------------|
| `/pricing` | Público | Landing de planes |
| `/checkout` | Público | Registro + pago |
| `/subscribers` | SUPER_ADMIN | Gestión de suscriptores |
| `/subscriptions` | COMPANY_ADMIN | Mi suscripción + upgrade |

### Componentes

- `UpgradePlanModal` - Modal para cambiar de plan
- `SubscriberActions` - Menú de aprobar/rechazar
- Checkout con flujo de 3 pasos: registro → pago → éxito

## Pendientes para Producción

1. **Webhooks de pago real** (en implementación)
   - Stripe: Webhook handler
   - MercadoPago: Webhook handler (demo implementado)

2. **Notificaciones por email** ✅ (IMPLEMENTADO)
   - Bienvenida al registrar
   - Notificación de aprobación
   - Notificación de rechazo
   - Recordatorio de renovación (pendiente)

3. **Prorrateo**
   - Calcular precio restante del mes actual al hacer upgrade

4. **Métricas de ingresos**
   - MRR (Monthly Recurring Revenue)
   - ARR (Annual Recurring Revenue)
   - Churn rate

5. **UI de Notificaciones en tiempo real**
   - WebSocket o Server-Sent Events para notificaciones push

## Archivos Creados/Modificados

### Backend - Nuevos Archivos
- `prisma/schema.prisma` - Modelo Notification agregado
- `src/modules/notifications/notifications.service.ts` - Servicio de notificaciones
- `src/modules/notifications/notifications.controller.ts` - Controlador REST
- `src/modules/notifications/notifications.module.ts` - Módulo NestJS
- `src/modules/email/email.service.ts` - Servicio de email con templates
- `src/modules/email/email.processor.ts` - Processor BullMQ
- `src/modules/email/email.module.ts` - Módulo de email
- `frontend/app/api/auth/register/route.ts` - Endpoint registro

### Backend - Modificados
- `src/app.module.ts` - Agregados módulos Notifications y Email
- `src/modules/auth/auth.service.ts` - Registro con plan + notificaciones
- `src/modules/auth/auth.controller.ts` - Registro público
- `src/modules/auth/dto/auth.dto.ts` - DTOs con planCode
- `src/modules/subscriptions/subscriptions.service.ts` - Aprobar/rechazar + notificaciones
- `src/modules/subscriptions/subscriptions.controller.ts` - Endpoints admin
- `src/modules/payments/payments.service.ts` - Webhooks con notificaciones

### Frontend - Nuevos Archivos
- `app/api/auth/register/route.ts` - API route para registro
- `app/(dashboard)/subscribers/page.tsx` - Página suscriptores
- `components/subscribers/subscriber-actions.tsx` - Acciones de approve/reject
- `components/subscriptions/upgrade-plan-modal.tsx` - Modal upgrade
- `components/notifications/notifications-client.tsx` - Componente notificaciones

### Frontend - Modificados
- `app/checkout/page.tsx` - Flujo completo registro + pago
- `app/(dashboard)/notifications/page.tsx` - Página notificaciones
- `app/(dashboard)/layout.tsx` - Sidebar
- `components/layout/app-sidebar.tsx` - Ruta suscriptores
- `types/api.ts` - Tipos Notification, SubscriberWithCompany

---

# Sistema de Notificaciones

## Modelo de Datos

```prisma
enum NotificationType {
  SUBSCRIPTION_PENDING
  SUBSCRIPTION_APPROVED
  SUBSCRIPTION_REJECTED
  PAYMENT_RECEIVED
  PAYMENT_FAILED
  ACCOUNT_ACTIVATED
  PLAN_UPGRADED
  GENERAL
}

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
}
```

## Endpoints

```http
GET /api/notifications
GET /api/notifications/unread-count
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
```

## Servicios

- **NotificationsService**: CRUD de notificaciones
- **EmailService**: Templates de email (demo logs)

## Flujo

1. **Registro**: Notificación + Email de "pendiente de aprobación"
2. **Aprobación**: Notificación + Email de "aprobado"
3. **Rechazo**: Notificación + Email de "rechazado"
4. **Pago webhook**: Notificación + Email de "pago recibido"
