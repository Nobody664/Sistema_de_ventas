# Plan de Integración: Ciclo de Pago Mensual

## 1. Objetivo

Implementar el ciclo completo de pago mensual para suscripciones SaaS con:
- Prueba gratis 7 días → suscripción paga
- Ciclo de pago mensual automático (Basic S/100)
- Notificaciones proactivas (aviso pre-pago, suspensiones)
- Revisión administrativa via comprobantes (Yape/Plin/Transferencia)
- Dashboard para company_admin

## 2. Arquitectura

### Backend: Nuevos archivos

```
src/modules/billing/
├── billing.module.ts
├── billing.service.ts          # Scheduler + lógica de ciclo
├── billing.controller.ts       # Endpoints públicos para ciclo de pago
├── dto/
│   ├── billing.dto.ts
```

### Backend: Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Add `paymentId` a PaymentProof, `dueDate`/`periodStart`/`periodEnd` a Payment |
| `app.module.ts` | Importar BillingModule |
| `modules/payments/payments.service.ts` | Nuevos métodos para ciclo mensual |
| `modules/payments/payments.controller.ts` | Nuevos endpoints |
| `modules/payments/payment-settings.service.ts` | Integrar proof approval con payments |
| `modules/notifications/notifications.service.ts` | Nuevos tipos de notificación |

### Frontend: Nuevos archivos

```
app/(dashboard)/payments/page.tsx     # Historial de pagos
components/payments/payment-history.tsx  # Componente historial
components/payments/upload-monthly-proof.tsx  # Subir comprobante para pago mensual
```

### Frontend: Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `components/layout/app-sidebar.tsx` | Add link "Pagos" para company_admin |
| `app/(dashboard)/settings/page.tsx` | Add link a pagos |
| `types/api.ts` | Tipos para PaymentProof + Payment |

## 3. Schema (Prisma)

```prisma
model Payment {
  // existing fields...
  dueDate      DateTime?  @map("due_date")
  periodStart  DateTime?  @map("period_start")
  periodEnd    DateTime?  @map("period_end")
  
  paymentProofs PaymentProof[]
}

model PaymentProof {
  // existing fields...
  paymentId    String?    @map("payment_id")
  payment      Payment?   @relation(fields: [paymentId], references: [id])
}
```

## 4. Flujo de Ciclo Mensual

### 4.1. Billing Scheduler (corre diario via @Cron)

**Tarea 1: Crear pagos pendientes**
- Buscar subscriptions ACTIVE donde endDate <= now + 3 días
- Para cada una: crear PENDING payment para el próximo período
- Enviar notificación IN_APP + EMAIL: "Tu pago de S/100 vence el {date}"

**Tarea 2: Actualizar PAST_DUE**
- Buscar subscriptions ACTIVE donde endDate < now
- Cambiar status a PAST_DUE + company status a PAST_DUE
- Enviar notificación: "Tu suscripción está vencida"

**Tarea 3: Suspender PAST_DUE prolongado**
- Buscar subscriptions PAST_DUE donde endDate < now - 5 días
- Suspender compañía (company status = SUSPENDED)
- Enviar notificación: "Tu cuenta ha sido suspendida"

**Tarea 4: Procesar trials expirados**
- Ya existe en SubscriptionsService.processExpiredTrials()
- Mejorar con notificaciones

### 4.2. Flujo de Pago Mensual

1. **Scheduler** crea PENDING payment con subscription.endDate como dueDate
2. **Company_admin** ve en dashboard que tiene pago pendiente
3. Company_admin sube comprobante (imagen) via `POST /payments/proof/:paymentId`
4. El proof queda PENDIENTE y asociado al payment
5. **SUPER_ADMIN** revisa en panel de pagos pendientes
6. Al aprobar:
   - Payment → SUCCEEDED
   - Subscription.endDate extendido +1 mes
   - Company status → ACTIVE
   - Notificación al company_admin

### 4.3. Notificaciones Proactivas

| Momento | Tipo | Canal |
|---------|------|-------|
| 3 días antes del vencimiento | PAYMENT_DUE_SOON | IN_APP + EMAIL |
| Día del vencimiento | PAYMENT_DUE_TODAY | IN_APP + EMAIL |
| 3 días después vencido | PAYMENT_OVERDUE | IN_APP + EMAIL |
| Al suspender cuenta | SUBSCRIPTION_SUSPENDED | IN_APP + EMAIL |

## 5. Implementación

### 5.1. Backend

#### Paso 1: Schema migration
- Añadir campos al schema
- Ejecutar `prisma:migrate`

#### Paso 2: BillingModule
- `billing.service.ts`: Scheduler con @Cron y lógica de ciclo
- `billing.controller.ts`: Endpoints para ciclo de pago

#### Paso 3: Enhanced PaymentsService
- `getPaymentHistory(companyId)`: Historial completo con proofs
- `getCurrentPending(companyId)`: Pago pendiente actual
- `createPendingPayment(subscriptionId)`: Crear pago para próximo ciclo
- `uploadProofForPayment(paymentId, imageBase64)`: Subir comprobante
- `approvePaymentProof(proofId, reviewerId)`: Aprobar y extender suscripción

#### Paso 4: PaymentSettingsService review mejorado
- Al aprobar proof, actualizar payment correspondiente
- Extender subscription.endDate

### 5.2. Frontend

#### Paso 1: Payment History Page
- Tabla con historial de pagos
- Estado actual de suscripción
- Próximo vencimiento

#### Paso 2: Upload Proof Component
- Mostrar QR/datos de pago según provider
- Upload de imagen
- Confirmación

#### Paso 3: Sidebar + Settings
- Link "Pagos" en sidebar (visible para COMPANY_ADMIN)
- Link en settings

## 6. Dependencias

- `@nestjs/schedule` para @Cron (ya disponible en NestJS)
- No requiere nuevas librerías

## 7. Testing

1. `npm run lint` en backend y frontend
2. `npm run build` en backend y frontend
