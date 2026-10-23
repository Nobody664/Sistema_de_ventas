# Backend — Índice de Módulos

Cada archivo documenta un módulo NestJS (`backend/src/modules/<nombre>/`): endpoints
(método, ruta, roles, módulo/feature de plan, body, respuesta, efectos) y funciones del servicio.

Convenciones generales (guards, errores, CSRF, paginación): ver
[`../convenciones-api.md`](../convenciones-api.md) y [`../arquitectura.md`](../arquitectura.md).

| Módulo | Prefijo de ruta | Documento | Descripción |
|--------|-----------------|-----------|-------------|
| auth | `/auth` | [auth.md](./auth.md) | Login, registro, refresh, logout, recuperación de contraseña, perfil. |
| users | — | [users.md](./users.md) | Servicio interno de usuarios (creado por auth). |
| companies | `/companies` | [companies.md](./companies.md) | CRUD de empresas (tenants). |
| company-profile | `/company-profile` | [company-profile.md](./company-profile.md) | Perfil/onboarding de la empresa. |
| plans | `/plans` | [plans.md](./plans.md) | Catálogo de planes (público). |
| subscriptions | `/subscriptions` | [subscriptions.md](./subscriptions.md) | Suscripción de la empresa + solicitudes de upgrade. |
| payments | `/payments`, `/checkout-requests`, `/payment-settings` | [payments.md](./payments.md) | Pagos de suscripción, solicitudes de checkout y pasarelas. |
| billing | `/billing` | [billing.md](./billing.md) | Resumen/facturación de la suscripción. |
| products | `/products` | [products.md](./products.md) | Productos, presentaciones y **categorías**. |
| inventory | `/inventory` | [inventory.md](./inventory.md) | Movimientos y stock por sucursal. |
| stock-entries | `/stock-entries` | [stock-entries.md](./stock-entries.md) | Entradas de mercadería. |
| product-batches | `/product-batches` | [product-batches.md](./product-batches.md) | Lotes con vencimiento. |
| kardex | `/kardex` | [kardex.md](./kardex.md) | Kardex valorizado (FIFO / promedio ponderado). |
| replenishment | `/replenishment` | [replenishment.md](./replenishment.md) | Reposición y pronóstico de demanda. |
| low-stock | (cron) | [low-stock.md](./low-stock.md) | Alertas de stock bajo (job programado). |
| branches | `/branches` | [branches.md](./branches.md) | Sucursales. |
| sales | `/sales` | [sales.md](./sales.md) | Punto de venta, cancelación/devolución y ventas a distribuidor. |
| discounts | `/discounts` | [discounts.md](./discounts.md) | Cupones de descuento (cupo de usos, vigencia, consumo en la venta). |
| finance | `/finance` | [finance.md](./finance.md) | Control financiero: entradas/salidas manuales + ventas automáticas, resumen y totales semanales. |
| customers | `/customers` | [customers.md](./customers.md) | Clientes. |
| employees | `/employees` | [employees.md](./employees.md) | Empleados. |
| distributors | `/distributors` | [distributors.md](./distributors.md) | Distribuidores, entregas y saldos. |
| invoices | `/invoices`, `/invoice-templates` | [invoices.md](./invoices.md) | Plantillas de boleta y generación de comprobantes. |
| reports | `/reports` | [reports.md](./reports.md) | Reportes de ventas/financieros y exportación. |
| dashboard | `/dashboard` | [dashboard.md](./dashboard.md) | Métricas del panel principal. |
| notifications | `/notifications` | [notifications.md](./notifications.md) | Notificaciones in-app. |
| email | — | [email.md](./email.md) | Envío de correos (SMTP). |
| audit | `/audit` | [audit.md](./audit.md) | Log de auditoría por empresa. |
| dni | `/dni` | [dni.md](./dni.md) | Consulta de DNI (RENIEC). |
| platform | `/platform/*` | [platform.md](./platform.md) | Área de super-admin (empresas, planes, suscriptores, plantillas, auditoría). |
| plan-capabilities | `/plan-capabilities` | [plan-capabilities.md](./plan-capabilities.md) | Capacidades y cuotas del plan. |
| health | `/health` | [health.md](./health.md) | Liveness/readiness. |
