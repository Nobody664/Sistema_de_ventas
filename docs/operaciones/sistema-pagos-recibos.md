# Sistema de Pagos y Recibos

## Resumen

Este documento describe el sistema de cobros recurrentes, generación de recibos y manejo de estados de pago en el sistema SaaS.

--- 

## Flujo de Pagos

### 1. Registro de Empresa (Gratis)
```
Usuario → Registrarse → Empresa FREE (TRIAL)
```

### 2. Upgrade de Plan
```
Empresa FREE → Checkout → Subir comprobante → SUPER_ADMIN aprobar → Plan activo
```

### 3. Renovación de Suscripción
```
Sistema → Verificar fecha de vencimiento → Generar recibo → Notificar usuario
```

---

## Estados de Empresa

| Estado | Descripción | Acción |
|--------|-------------|--------|
| `TRIAL` | Cuenta en período de prueba | Puede mejorar a plan de pago |
| `ACTIVE` | Cuenta activa con plan de pago | Acceso completo |
| `PAST_DUE` | Pago pendiente | Acceso limitado hasta pagar |
| `SUSPENDED` | Cuenta suspendida | Sin acceso |
| `INACTIVE` | Cuenta desactivada | Eliminación pendiente |

---

## Estados de Suscripción

| Estado | Descripción |
|--------|-------------|
| `TRIALING` | Período de prueba activo |
| `ACTIVE` | Suscripción activa con pago |
| `PAST_DUE` | Pago vencido |
| `CANCELED` | Suscripción cancelada |
| `EXPIRED` | Suscripción vencida |

---

## Modelo de Datos

### Payment (Pago/Recibo)

```prisma
model Payment {
  id               String         @id @default(cuid())
  subscriptionId   String
  provider         PaymentProvider
  transactionId    String?
  amount           Decimal        @db.Decimal(10, 2)
  currency         String         @default("PEN")
  status           PaymentStatus
  providerPayload  Json?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  subscription     Subscription   @relation(...)
}
```

### PaymentStatus

```prisma
enum PaymentStatus {
  PENDING    // Pendiente de pago
  PROCESSING // Procesando
  SUCCEEDED  // Pagado exitosamente
  FAILED     // Fallido
  REFUNDED   // Reembolsado
}
```

---

## Generación de Recibos

### Información del Recibo

Cada recibo debe contener:
- **Número de recibo**: `RCP-YYYYMMDD-XXXX`
- **Fecha de emisión**
- **Datos del cliente**: Empresa, RUC, dirección
- **Plan contratado**: Nombre, precio mensual
- **Método de pago**: Yape, Plin, Transferencia
- **Monto total**: Con IGV incluido
- **Vencimiento**: Fecha límite de pago

### Ejemplo de Recibo

```
====================================
         RECIBO DE PAGO
====================================
Número:    RCP-20240315-0001
Fecha:     15/03/2024
Vencim.:   15/04/2024
====================================

CLIENTE:
Empresa:   Mi Tienda SAC
RUC:       20123456789
Dirección: Av. Principal 123

====================================
PLAN CONTRATADO
====================================
Plan:      Growth
Precio:    S/ 59.00/mes
IGV (18%): S/ 10.62
------------------------------------
TOTAL:     S/ 69.62
====================================

MÉTODO DE PAGO
Yape:      999888777

====================================
Gracias por su preferencia
```

---

## Sistema de Notificaciones

### Notificaciones de Pago

| Evento | Canal | Destinatario | Mensaje |
|--------|-------|--------------|---------|
| Payment Created | In-App | COMPANY_ADMIN | Nuevo recibo generado |
| Payment Due Soon | Email + In-App | COMPANY_ADMIN | Recordatorio de pago |
| Payment Overdue | Email + In-App | COMPANY_ADMIN | Pago vencido |
| Payment Received | Email | SUPER_ADMIN | Nuevo pago recibido |

### Plantillas de Email

#### Recordatorio de Pago
```
Asunto: Recordatorio: Tu recibo RCP-XXXX vence pronto

Hola [Nombre],

Tu recibo por el plan [Plan] vence el [Fecha].
Monto a pagar: S/ [Monto]

Realiza tu pago y evita la suspensión de tu cuenta.

[Pagar ahora]
```

#### Pago Vencido
```
Asunto: Acción requerida: Pago vencido

Hola [Nombre],

Tu cuenta ha sido suspendida por falta de pago.
Monto vencido: S/ [Monto]

Por favor realiza tu pago para restaurar el acceso.

[Pagar ahora]
```

---

## API de Pagos

### Endpoints

```
GET    /payments                  - Listar pagos (COMPANY_ADMIN)
GET    /payments/:id              - Ver detalle del pago (COMPANY_ADMIN)
POST   /payments                  - Crear pago manual (SUPER_ADMIN)
GET    /payments/receipt/:id      - Generar PDF del recibo (COMPANY_ADMIN)
POST   /payments/:id/mark-paid    - Marcar como pagado (SUPER_ADMIN)
GET    /payments/pending          - Pagos pendientes (SUPER_ADMIN)
```

### Respuesta de Pago

```json
{
  "id": "pay_xxx",
  "subscriptionId": "sub_xxx",
  "amount": "69.62",
  "currency": "PEN",
  "status": "PENDING",
  "dueDate": "2024-04-15",
  "createdAt": "2024-03-15",
  "plan": {
    "name": "Growth",
    "priceMonthly": "59.00"
  },
  "company": {
    "name": "Mi Tienda SAC",
    "taxId": "20123456789"
  }
}
```

---

## Flujo de Cobro Recurrente

```
1. DIARIO: Verificar suscripciones próximas a vencer
   └─ 7 días antes: Enviar recordatorio
   └─ 1 día antes: Enviar último recordatorio
   
2. DÍA DE VENCIMIENTO: Generar nuevo recibo
   └─ Crear Payment con status PENDING
   └─ Notificar al cliente
   
3. POST-VENCIMIENTO: Si no hay pago
   └─ 1 día: Estado PAST_DUE
   └─ 7 días: Suspender cuenta (SUSPENDED)
   └─ 30 días: Desactivar cuenta (INACTIVE)

4. PAGO RECIBIDO: Procesar comprobante
   └─ Validar monto
   └─ Actualizar Payment a SUCCEEDED
   └─ Renovar suscripción
   └─ Notificar al cliente
```

---

## Configuración de Métodos de Pago

### PaymentSettings

```prisma
model PaymentSettings {
  id              String          @id @default(cuid())
  provider        PaymentProvider  @unique
  isEnabled       Boolean         @default(false)
  qrImageBase64   String?         @db.Text
  accountNumber   String?
  accountName     String?
  instructions    String?          @db.Text
  config          Json?
}
```

### Proveedores Soportados

| Proveedor | Tipo | Configuración |
|-----------|------|---------------|
| Yape | QR | QR image, número de cuenta |
| Plin | QR | QR image, número de cuenta |
| Transfer | Manual | Número de cuenta, titular |
| Stripe | Online | API keys |
| MercadoPago | Online | Access token |

---

## Dashboard de Pagos (Super Admin)

### Métricas

- **MRR**: Ingreso mensual recurrente
- **Cobrado**: Total facturado este mes
- **Pendiente**: Facturas pendientes de pago
- **Vencido**: Facturas vencidas sin pagar

### Acciones

- Ver todos los pagos
- Generar reporte de cobros
- Enviar recordatorios manuales
- Aprobar/rechazar comprobantes
- Generar facturas PDF

---

## Casos de Uso

### 1. Usuario nuevo con plan gratuito
- Se crea empresa con status TRIAL
- Suscripción con status TRIALING
- Sin pagos generados

### 2. Upgrade a plan de pago
- COMPANY_ADMIN solicita upgrade
- Sube comprobante de pago
- SUPER_ADMIN aprueba
- Se crea Payment con status SUCCEEDED
- Suscripción cambia a ACTIVE
- Empresa cambia a ACTIVE

### 3. Renovación mensual
- Sistema genera nuevo Payment (PENDING)
- Envía notificación al cliente
- Cliente paga y sube comprobante
- SUPER_ADMIN verifica y marca como SUCCEEDED
- Suscripción se renueva

### 4. Pago vencido
- No hay pago antes del vencimiento
- Sistema cambia status a PAST_DUE
- Envía notificación de pago vencido
- Limita acceso a funciones premium
- Después de 7 días: SUSPENDED

---

## Mejores Prácticas

1. **Nunca confiar solo en webhooks** - Siempre verificar contra la base de datos
2. **Idempotencia** - Procesar cada webhook una sola vez
3. **conciliación diaria** - Verificar estado de pagos contra proveedores
4. **Notificaciones proactivas** - Recordar antes de que venza
5. **Grace periods** - Dar tiempo extra antes de suspender
