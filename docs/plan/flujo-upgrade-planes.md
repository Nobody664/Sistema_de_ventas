# Flujo de Upgrade de Planes - Sistema de Suscripciones

## Resumen Ejecutivo

Este documento describe el flujo completo de actualización de planes en el sistema SaaS de ventas, incluyendo: selección de plan, pago offline (Yape/Plin/Transferencia), validación de comprobante, aprobación por Super Admin, y liberación de beneficios.

---

## 1. Flujo General

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Usuario    │────▶│  Selección  │────▶│   Pago      │────▶│  Envío      │
│  selecciona │     │  Plan +     │     │  Offline    │     │  Comprobante│
│  "Cambiar   │     │  Método     │     │  (QR/Datos)│     │  (Obligatorio│
│   Plan"     │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                    │
                                                                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Notificación│◀────│ Super Admin │◀────│  Revisión   │◀────│ Pendiente   │
│  al usuario │     │ Aprueba/    │     │  Comprobante│     │  Payment    │
│  (Email+InApp)    │  Rechaza    │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 2. Roles y Responsabilidades

### COMPANY_ADMIN (Usuario Empresa)
- Seleccionar nuevo plan
- Elegir método de pago (Yape/Plin/Transferencia)
- Subir comprobante de pago (OBLIGATORIO)
- Esperar aprobación

### SUPER_ADMIN (Administrador del Sistema)
- Revisar solicitudes pendientes
- Verificar comprobante de pago
- Aprobar o rechazar solicitud
- Liberar beneficios del nuevo plan

---

## 3. Métodos de Pago Soportados

| Método | Tipo |QR| Número Cuenta | 
|--------|------|--|--------------|
| YAPE | Billetera | ✅ | Configurable |
| PLIN | Billetera | ✅ | Configurable |
| TRANSFER | Banco | ❌ | IBAN/Cuenta |

---

## 4. Estados de Solicitud

| Estado | Descripción | Color UI |
|--------|-------------|----------|
| PENDING | Esperando pago del usuario | Amber |
| SUBMITTED | Comprobante enviado, esperando revisión | Blue |
| APPROVED | Aprobado, plan actualizado | Green |
| REJECTED | Rechazado | Red |

---

## 5. Backend - Endpoints

### Crear Solicitud de Upgrade
```
POST /api/subscriptions/upgrade-requests
Body: {
  "newPlanCode": "START|GROWTH|SCALE",
  "paymentMethod": "YAPE|PLIN|TRANSFER",
  "billingCycle": "MONTHLY|YEARLY"
}
Response: {
  "requestId": "uuid",
  "status": "PENDING",
  "paymentSettings": { QR, cuenta, instrucciones }
}
```

### Enviar Comprobante
```
POST /api/subscriptions/upgrade-requests/:id/proof
Body: {
  "imageBase64": "data:image/png;base64,...",
  "paymentDate": "2024-01-15T10:30:00Z"
}
```

### Listar Pendientes (Super Admin)
```
GET /api/subscriptions/upgrade-requests/pending
```

### Revisar Solicitud (Super Admin)
```
POST /api/subscriptions/upgrade-requests/:id/review
Body: {
  "status": "APPROVED|REJECTED",
  "reviewNotes": "Opcional"
}
```

---

## 6. Notificaciones Internas

### Eventos que generan notificación:

| Evento | Destinatario | Canal | Mensaje |
|--------|--------------|-------|---------|
| Solicitud creada | Super Admin | In-App | Nueva solicitud de upgrade de {empresa} |
| Comprobante enviado | Super Admin | In-App | {empresa} subió comprobante de pago |
| Upgrade aprobado | COMPANY_ADMIN | In-App + Email | Tu cambio al plan {plan} fue aprobado |
| Upgrade rechazado | COMPANY_ADMIN | In-App + Email | Tu solicitud fue rechazada: {notas} |

---

## 7. Webhooks (Futuro)

Los webhooks permiten notificación en tiempo real a sistemas externos.

### Eventos soportados:
- `subscription.created`
- `subscription.upgraded`
- `subscription.cancelled`
- `subscription.expired`
- `payment.received`

### Formato del webhook:
```json
{
  "event": "subscription.upgraded",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "companyId": "uuid",
    "oldPlan": "FREE",
    "newPlan": "START",
    "status": "ACTIVE"
  }
}
```

---

## 8. Beneficios por Plan

| Beneficio | FREE | START | GROWTH | SCALE |
|-----------|------|-------|--------|-------|
| Usuarios | 1 | 3 | 15 | Ilimitados |
| Productos | 50 | 500 | 10,000 | Ilimitado |
| Sucursales | 1 | 1 | 3 | Ilimitadas |
| Reportes | Básico | Básico | Avanzado | Completo |
| API Access | ❌ | ❌ | ✅ | ✅ |
| Webhooks | ❌ | ❌ | ✅ | ✅ |
| Soporte | Email | Email | Priority | Premium |

---

## 9. Seguridad y Validaciones

### Validaciones del lado del servidor:
1. **Plan actual**: No puede solicitar el mismo plan
2. **Método de pago**: Debe estar habilitado en configuración
3. **Comprobante**: 
   - Formato: Solo imágenes (PNG, JPG, JPEG)
   - Tamaño máximo: 5MB
   - Obligatorio para aprobar
4. **Límite**: Solo 1 solicitud pendiente por empresa

### Prevención de fraude:
- Verificación manual de comprobantes
- Notas de revisión obligatorias al rechazar
- Historial completo de solicitudes

---

## 10. Casos de Error

| Error | Causa | Solución |
|-------|-------|----------|
| "Ya tienes ese plan activo" | Plan seleccionado = Plan actual | Seleccionar otro plan |
| "Método de pago no disponible" | Yape/Plin deshabilitado | Habilitar en settings |
| "La solicitud ya fue enviada" | Ya existe PENDING | Completar o cancelar anterior |
| "Formato de comprobante inválido" | No es imagen | Subir imagen válida |

---

## 11. APIs Externas a Integrar (Futuro)

- **Stripe**: Pagos con tarjeta
- **MercadoPago**: Pagos en LATAM
- **PayPal**: Pagos internacionales

---

## 12. Diagramas de Secuencia

### Happy Path (Usuario)
```
Usuario              Frontend              Backend              SuperAdmin
  │                     │                     │                     │
  │ 1. Click "Cambiar" │                     │                     │
  │────────────────────>│                     │                     │
  │                     │ 2. POST /upgrade    │                     │
  │                     │────────────────────>│                     │
  │                     │                     │ 3. Create Request  │
  │                     │                     │────────────────────>│
  │                     │                     │<────────────────────│
  │                     │<────────────────────│                     │
  │<────────────────────│                     │                     │
  │ 4. Show Payment UI │                     │                     │
  │                     │                     │                     │
  │ 5. Upload Image   │                     │                     │
  │────────────────────>│                     │                     │
  │                     │ 6. POST /proof      │                     │
  │                     │────────────────────>│                     │
  │                     │                     │ 7. Notify Admin    │
  │                     │                     │────────────────────>│
  │                     │<────────────────────│                     │
  │<────────────────────│                     │                     │
  │ 8. "En espera"    │                     │                     │
```

### Happy Path (Super Admin)
```
SuperAdmin           Frontend              Backend              Database
  │                     │                     │                     │
  │ 1. View Pending    │                     │                     │
  │────────────────────>│                     │                     │
  │                     │ 2. GET /pending     │                     │
  │                     │────────────────────>│                     │
  │                     │                     │ 3. SELECT          │
  │                     │                     │────────────────────>│
  │                     │                     │<────────────────────│
  │                     │<────────────────────│                     │
  │<────────────────────│                     │                     │
  │ 4. Show Requests   │                     │                     │
  │                     │                     │                     │
  │ 5. Click "Approve"│                     │                     │
  │────────────────────>│                     │                     │
  │                     │ 6. POST /review     │                     │
  │                     │ (APPROVED)          │                     │
  │                     │────────────────────>│                     │
  │                     │                     │ 7. Update Sub     │
  │                     │                     │────────────────────>│
  │                     │                     │<────────────────────│
  │                     │                     │ 8. Create Payment │
  │                     │                     │────────────────────>│
  │                     │                     │<────────────────────│
  │                     │                     │ 9. Update Request │
  │                     │                     │────────────────────>│
  │                     │                     │<────────────────────│
  │                     │<────────────────────│                     │
  │<────────────────────│                     │                     │
  │ 10. "Aprobado"     │                     │                     │
```

---

## 13. Configuración de Payment Settings

Los administradores configuran los métodos de pago en:
```
GET /api/payments/settings
POST /api/payments/settings
```

Campos:
- provider: YAPE | PLIN | TRANSFER
- isEnabled: boolean
- qrImageBase64: string (para Yape/Plin)
- accountNumber: string
- accountName: string
- instructions: string

---

## 14. Métricas y Reportes

### Dashboard Super Admin:
- Total solicitudes
- Solicitudes pendientes
- Solicitudes aprobadas (mes)
- Solicitudes rechazadas (mes)
- Ingresos por upgrades

---

## 15. Testing Checklist

- [ ] Usuario puede seleccionar plan
- [ ] Usuario puede seleccionar método de pago
- [ ] QR se muestra correctamente para Yape/Plin
- [ ] Datos de cuenta se muestran para Transferencia
- [ ] Comprobante es obligatorio para enviar
- [ ] Imagen se guarda correctamente (base64)
- [ ] Notificación llega a Super Admin
- [ ] Super Admin puede ver solicitud
- [ ] Super Admin puede ver imagen del comprobante
- [ ] Super Admin puede aprobar
- [ ] Super Admin puede rechazar
- [ ] COMPANY_ADMIN recibe notificación de aprobación
- [ ] COMPANY_ADMIN recibe notificación de rechazo
- [ ] Plan se actualiza en la base de datos
- [ ] Beneficios se liberan según el nuevo plan
