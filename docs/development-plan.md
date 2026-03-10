# Plan de Desarrollo

## Fase 1. Fundaciones

- Monorepo con `frontend` y `backend`.
- Configuración compartida y variables de entorno.
- Prisma schema multi-tenant.
- Autenticación base con JWT y refresh token.
- Dashboard shell y landing page.

## Fase 2. Core Operacional

- Empresas, planes, suscripciones y pagos.
- Productos, categorías e inventario.
- Clientes y empleados.
- POS con carrito, venta, ticket y devoluciones.

## Fase 3. Inteligencia y Operación

- Dashboard por rol.
- Reportes por día, producto, empleado y cliente.
- Exportación Excel y PDF.
- Alertas de stock bajo y notificaciones.

## Fase 4. Escala y Plataforma

- Webhooks públicos.
- API pública versionada.
- Observabilidad.
- Particionado de ventas.
- Automatizaciones con BullMQ.

## Entregables iniciales

- Decisión de multi-tenancy documentada.
- Esqueleto NestJS productivo.
- Esqueleto Next.js App Router.
- Modelo de datos Prisma.
- Docker Compose local.

