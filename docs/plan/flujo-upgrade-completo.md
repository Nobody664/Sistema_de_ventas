# Flujo Completo de Upgrade de Planes

## Resumen

Este documento describe el flujo completo de negocio para la mejora de planes en el sistema SaaS de ventas.

---

## Actores

| Rol | Descripción |
|-----|-------------|
| **COMPANY_ADMIN** | Administrador de una empresa cliente |
| **SUPER_ADMIN** | Administrador del sistema |

---

## Flujo 1: Checkout (Nuevos Clientes)

### Descripción
Usuario nuevo que quiere crear una cuenta y suscribirse directamente a un plan de pago.

### Pasos

```
┌─────────────────────────────────────────────────────────────────┐
│                        NUEVO CLIENTE                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Accede a /checkout?plan=START                              │
│  2. Selecciona método de pago (Yape/Plin/Transfer)            │
│  3. Realiza pago y sube comprobante                            │
│  4. Solicitud queda en estado "SUBMITTED"                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      SUPER_ADMIN                               │
├─────────────────────────────────────────────────────────────────┤
│  5. Ve solicitud en /upgrade-requests (pestaña Checkout)      │
│  6. Revisa comprobante de pago                                  │
│  7. Aprueba o rechaza                                          │
│     - SI: Crea empresa, usuario, suscripción                  │
│     - NO: Notifica al cliente                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    COMPANY_ADMIN                               │
├─────────────────────────────────────────────────────────────────┤
│  8. Recibe email de aprobación                                │
│  9. Puede acceder al sistema con su cuenta                    │
│  10. Ve su plan activo en /subscription                       │
│  11. Tiene límites del plan (usuarios, productos)             │
└─────────────────────────────────────────────────────────────────┘
```

### Estados de CheckoutRequest

| Estado | Descripción |
|--------|-------------|
| `DRAFT` | Solicitud creada, sin comprobante |
| `SUBMITTED` | Comprobante subido, pendiente revisión |
| `APPROVED` | Aprobado, cuenta creada |
| `REJECTED` | Rechazado |

---

## Flujo 2: Upgrade (Clientes Existentes)

### Descripción
Empresa existente con plan Trial o de pago que quiere mejorar a un plan superior.

### Pasos

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPANY_ADMIN                                │
├─────────────────────────────────────────────────────────────────┤
│  1. Accede a /subscription                                    │
│  2. Click en "Mejorar plan"                                   │
│  3. Selecciona nuevo plan                                     │
│  4. Selecciona método de pago                                  │
│  5. Realiza pago y sube comprobante                            │
│  6. Solicitud queda en estado "PENDING"                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      SUPER_ADMIN                               │
├─────────────────────────────────────────────────────────────────┤
│  7. Ve solicitud en /upgrade-requests (pestaña Suscripciones) │
│  8. Revisa comprobante de pago                                 │
│  9. Aprueba o rechaza                                         │
│     - SI: Actualiza suscripción al nuevo plan                 │
│     - NO: Notifica al cliente                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    COMPANY_ADMIN                               │
├─────────────────────────────────────────────────────────────────┤
│  10. Recibe notificación de aprobación                         │
│  11. Ve su plan actualizado en /subscription                  │
│  12. Accede a los nuevos beneficios/recursos                 │
│  13. El sistema aplica los nuevos límites                     │
└─────────────────────────────────────────────────────────────────┘
```

### Estados de PlanUpgradeRequest

| Estado | Descripción |
|--------|-------------|
| `PENDING` | Pendiente de pago |
| `APPROVED` | Aprobado, plan actualizado |
| `REJECTED` | Rechazado |

---

## Límites de Planes

Los planes tienen límites que se aplican automáticamente:

| Plan | maxUsers | maxProducts | Características |
|------|----------|-------------|-----------------|
| FREE | 2 | 50 | Básico |
| START | 5 | 500 | Intermedio |
| GROWTH | 15 | 2000 | Profesional |
| SCALE | 50 | 10000 | Enterprise |

### Validación de Límites

Cuando un COMPANY_ADMIN intenta:
- **Crear usuario**: Se valida `maxUsers` actual vs usuarios actuales
- **Crear producto**: Se valida `maxProducts` actual vs productos actuales
- **Crear empleado**: Se valida contra `maxUsers`

---

## Reglas de Negocio

### 1. Checkout (Nuevos Clientes)
- ✅ El método de pago debe estar habilitado
- ✅ El comprobante es obligatorio
- ✅ El email no debe existir previamente
- ✅ Al aprobar: se crea empresa, usuario, suscripción
- ✅ La suscripción queda activa inmediatamente

### 2. Upgrade (Clientes Existentes)
- ✅ Debe tener suscripción activa
- ✅ No puede solicitar upgrade si ya tiene solicitud pendiente
- ✅ El nuevo plan debe ser diferente al actual
- ✅ Al aprobar: la suscripción se actualiza al nuevo plan
- ✅ Los límites se aplican inmediatamente

### 3. Downgrade
- No implementado actualmente (solo upgrades)
- Company puede esperar a que expire para cambiar

---

## Notificaciones

| Evento | Canal | Destinatario | Mensaje |
|--------|-------|--------------|---------|
| Checkout Submitted | Email | SUPER_ADMIN | Nueva solicitud de registro |
| Upgrade Submitted | In-App | SUPER_ADMIN | Nueva solicitud de upgrade |
| Approved | Email + In-App | COMPANY_ADMIN | Tu plan ha sido aprobado |
| Rejected | Email | COMPANY_ADMIN | Tu solicitud fue rechazada |

---

## API Endpoints

### Checkout Requests
```
POST   /payments/checkout/requests           - Crear solicitud
POST   /payments/checkout/requests/:id/proof - Subir comprobante
GET    /payments/checkout/requests/pending    - Listar pendientes (SUPER_ADMIN)
PATCH  /payments/checkout/requests/:id/review - Revisar (aprobar/rechazar)
```

### Plan Upgrade Requests
```
POST   /subscriptions/upgrade-requests              - Crear solicitud
POST   /subscriptions/upgrade-requests/:id/proof   - Subir comprobante
GET    /subscriptions/upgrade-requests/pending     - Listar pendientes
POST   /subscriptions/upgrade-requests/:id/review   - Revisar
```

---

## Páginas

| Página | Rol | Descripción |
|--------|-----|-------------|
| `/checkout` | Público | Registro + pago nuevo cliente |
| `/subscription` | COMPANY_ADMIN | Ver plan actual, mejorar |
| `/upgrade-requests` | SUPER_ADMIN | Revisar todas las solicitudes |

---

## Ejemplo de Datos

### CheckoutRequest aprobado
```json
{
  "id": "req_xxx",
  "companyName": "Mi Tienda SAC",
  "email": "admin@mitienda.com",
  "plan": { "code": "START", "name": "Start" },
  "provider": "YAPE",
  "amount": "19.00",
  "status": "APPROVED",
  "companyId": "comp_xxx",
  "subscriptionId": "sub_xxx"
}
```

### PlanUpgradeRequest aprobado
```json
{
  "id": "upg_xxx",
  "company": { "name": "Mi Tienda SAC" },
  "currentPlan": { "code": "FREE", "name": "Free" },
  "newPlan": { "code": "START", "name": "Start" },
  "provider": "PLIN",
  "amount": "19.00",
  "status": "APPROVED"
}
```
