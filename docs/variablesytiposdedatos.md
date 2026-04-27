# Variables y Tipos del Sistema

Documentación generada desde el análisis del Frontend -alignada 100% con el código fuente.

---

## Módulo: Products
### Endpoint: POST /products (Create)

| Campo | Tipo | Requerido | Descripción |
|------|------|----------|------------|
| name | string | Sí | Nombre del producto |
| sku | string | No | Código SKU |
| barcode | string | No | Código de barras |
| description | string | No | Descripción |
| costPrice | number | Sí | Precio de costo |
| salePrice | number | Sí | Precio de venta |
| stockQuantity | number | Sí | Cantidad en stock |
| minStock | number | No | Stock mínimo (default: 5) |
| categoryId | string | No | ID de categoría |
| imageUrl | string | No | URL de imagen (base64) |

### Endpoint: PATCH /products/:id (Update)

Mismos campos que Create.

### Endpoint: GET /products (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| id | string | ID único |
| name | string | Nombre |
| sku | string | Código SKU |
| barcode | string | Código de barras |
| description | string | Descripción |
| imageUrl | string | URL de imagen |
| costPrice | string | Precio de costo |
| salePrice | string | Precio de venta |
| stockQuantity | number | Cantidad en stock |
| minStock | number | Stock mínimo |
| status | string | Estado |
| categoryId | string | ID de categoría |
| category | Category | Categoría anidada |
| createdAt | string | Fecha creación |
| updatedAt | string | Fecha actualización |

---

## Módulo: Categories
### Endpoint: POST /products/categories (Create)

| Campo | Tipo | Requerido | Descripción |
|------|------|----------|------------|
| name | string | Sí | Nombre de categoría |
| description | string | No | Descripción |

### Endpoint: PATCH /products/categories/:id (Update)

Mismos campos que Create.

### Endpoint: GET /products/categories (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| id | string | ID único |
| name | string | Nombre |
| slug | string | Slug URL |
| description | string | Descripción |
| _count | object | Conteo de productos |

---

## Módulo: Customers
### Endpoint: POST /customers (Create)

| Campo | Tipo | Requerido | Descripción |
|------|------|----------|------------|
| firstName | string | Sí | Nombres |
| lastName | string | Sí | Apellidos |
| email | string | No | Correo electrónico |
| phone | string | No | Teléfono |
| documentType | enum | Sí | Tipo: DNI, RUC, PASSPORT |
| documentValue | string | Sí | Número de documento |
| notes | string | No | Notas |

### Endpoint: PATCH /customers/:id (Update)

Mismos campos que Create.

### Endpoint: GET /customers (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| id | string | ID único |
| firstName | string | Nombres |
| lastName | string | Apellidos |
| email | string | Correo |
| phone | string | Teléfono |
| documentType | string | Tipo documento |
| documentValue | string | Número documento |
| notes | string | Notas |
| totalPurchases | number | Total compras |
| sales | array | Ventas anidadas |
| createdAt | string | Fecha creación |

---

## Módulo: Employees
### Endpoint: POST /employees (Create)

| Campo | Tipo | Requerido | Descripción |
|------|------|----------|------------|
| firstName | string | Sí | Nombres |
| lastName | string | Sí | Apellidos |
| email | string | Sí | Correo electrónico |
| phone | string | No | Teléfono |
| dni | string | Sí | DNI (8 dígitos) |
| role | enum | Sí | MANAGER, CASHIER, SUPPORT |
| isActive | boolean | No | Estado (default: true) |

### Endpoint: PATCH /employees/:id (Update)

Mismos campos que Create (email y dni opcionales en update).

### Endpoint: GET /employees (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| id | string | ID único |
| firstName | string | Nombres |
| lastName | string | Apellidos |
| email | string | Correo |
| phone | string | Teléfono |
| dni | string | DNI |
| role | string | Rol |
| isActive | boolean | Estado |
| createdAt | string | Fecha creación |
| user | object | Usuario enlazado |

---

## Módulo: Sales
### Endpoint: POST /sales (Create)

| Campo | Tipo | Requerido | Descripción |
|------|------|----------|------------|
| customerId | string | No | ID de cliente |
| paymentMethod | enum | Sí | CASH, CARD, TRANSFER |
| items | array | Sí | Array de items |
| items[].productId | string | Sí | ID del producto |
| items[].quantity | number | Sí | Cantidad |
| discountPercent | number | No | % descuento (default: 0) |
| notes | string | No | Notas |

### Endpoint: GET /sales (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| id | string | ID único |
| saleNumber | string | Número de venta |
| totalAmount | string | Monto total |
| subtotal | string | Subtotal |
| taxAmount | string | Impuesto |
| discountAmount | string | Descuento |
| paymentMethod | string | Método pago |
| status | string | Estado |
| paidAt | string | Fecha pago |
| customer | object | Cliente anidado |
| employee | object | Empleado anidado |
| items | array | Items anidados |

---

## Módulo: Auth/Register
### Endpoint: POST /auth/register

| Campo | Tipo | Requerido | Descripción |
|------|------|----------|------------|
| fullName | string | Sí | Nombre completo |
| companyName | string | Sí | Nombre de empresa |
| email | string | Sí | Correo electrónico |
| phone | string | No | Teléfono |
| password | string | Sí | Contraseña |
| planCode | string | No | Código de plan |

**Respuesta:**

| Campo | Tipo | Descripción |
|------|------|------------|
| accessToken | string | Token JWT |
| user | object | Usuario creado |

---

## Módulo: Subscriptions
### Endpoint: POST /subscriptions/upgrade-requests

| Campo | Tipo | Requerido | Descripción |
|------|------|----------|------------|
| newPlanCode | string | Sí | Código del nuevo plan |
| paymentMethod | string | Sí | Método de pago |

**Respuesta:**

| Campo | Tipo | Descripción |
|------|------|------------|
| requestId | string | ID de solicitud |
| status | string | Estado |
| currentPlan | object | Plan actual |
| newPlan | object | Nuevo plan |
| paymentMethod | string | Método pago |
| paymentSettings | object | Configuración pago |

### Endpoint: GET /subscriptions (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| id | string | ID único |
| companyId | string | ID empresa |
| planId | string | ID plan |
| status | string | Estado |
| billingCycle | string | Ciclo facturación |
| startDate | string | Fecha inicio |
| endDate | string | Fecha fin |
| autoRenew | boolean | Auto-renovación |
| canceledAt | string | Fecha cancelación |
| createdAt | string | Fecha creación |
| updatedAt | string | Fecha actualización |
| plan | Plan | Plan anidado |
| payments | array | Pagos anidados |

---

## Módulo: Companies (Admin)
### GET /companies (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| id | string | ID único |
| name | string | Nombre |
| slug | string | Slug URL |
| legalName | string | Razón social |
| taxId | string | RUC |
| address | string | Dirección |
| email | string | Correo |
| phone | string | Teléfono |
| status | string | Estado |
| trialEndsAt | string | Fin prueba |
| currency | string | Moneda |
| timezone | string | Zona horaria |
| createdAt | string | Fecha creación |
| subscription | object | Suscripción anidada |
| _count | object | Conteo |

---

## Módulo: Plans
### GET /plans (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| id | string | ID único |
| code | string | Código |
| name | string | Nombre |
| description | string | Descripción |
| priceMonthly | string | Precio mensual |
| priceYearly | string | Precio anual |
| billingCycle | string | Ciclo |
| maxUsers | number | Máximo usuarios |
| maxProducts | number | Máximo productos |
| features | array | Características |
| isActive | boolean | Estado |

---

## Módulo: Payment Settings
### GET /payments/settings (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| provider | string | Proveedor (YAPE, PLIN, TRANSFER) |
| isEnabled | boolean | Habilitado |
| qrImageBase64 | string | Imagen QR (opcional) |
| accountNumber | string | Número cuenta (opcional) |
| accountName | string | Nombre cuenta (opcional) |
| instructions | string | Instrucciones (opcional) |

---

## Módulo: Notifications
### GET /notifications (List) - Respuesta

| Campo | Tipo | Descripción |
|------|------|------------|
| id | string | ID único |
| userId | string | ID usuario |
| companyId | string | ID empresa |
| type | string | Tipo |
| channel | string | Canal |
| title | string | Título |
| message | string | Mensaje |
| data | object | Datos adicionales |
| isRead | boolean | Leído |
| sentAt | string | Fecha envío |
| createdAt | string | Fecha creación |

---

## Enums Detectados

| Enum | Valores |
|------|---------|
| DocumentType | DNI, RUC, PASSPORT |
| EmployeeRole | MANAGER, CASHIER, SUPPORT |
| PaymentMethod | CASH, CARD, TRANSFER |
| BillingCycle | MONTHLY, YEARLY |
| SubscriptionStatus | TRIALING, ACTIVE, CANCELED, EXPIRED |
| CompanyStatus | TRIAL, ACTIVE, SUSPENDED, CANCELED |
| PaymentStatus | PENDING, SUCCEEDED, FAILED |
| PaymentProvider | CASH, MERCADOPAGO, YAPE, PLIN, TRANSFER |

---

## Pendiente de Verificar

- [ ] CheckoutRequest: modelo completo para flujo de checkout público
- [ ] PlanUpgradeRequest: modelo para solicitudes de upgrade
- [ ] InventoryMovement: movimientos de inventario
- [ ] InvoiceTemplate: plantillas de facturas
- [ ] AuditLog: logs de auditoría