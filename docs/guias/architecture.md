# Arquitectura SaaS Multi-Empresa

## Objetivo

Construir una plataforma SaaS de ventas que permita a miles de empresas operar sobre una misma infraestructura con aislamiento lógico, alta concurrencia y capacidad de evolución hacia tenants enterprise.

## Estrategia multi-tenant evaluada

### 1. Tenant por columna

Ventajas:

- Menor costo operativo.
- Un solo pool de conexiones.
- Migraciones simples.
- Ideal para miles de empresas pequeñas y medianas.
- Permite explotar agregados globales del SaaS con facilidad.

Riesgos:

- Requiere disciplina estricta en filtros por tenant.
- Mayor cuidado en seguridad y observabilidad.

### 2. Tenant por schema

Ventajas:

- Mejor aislamiento lógico.
- Facilita personalizaciones por cliente enterprise.

Riesgos:

- Crece el costo de migraciones.
- Complejiza la operación con miles de tenants.
- Multiplica objetos y tiempos de despliegue.

### 3. Tenant por base de datos

Ventajas:

- Máximo aislamiento.
- Útil para clientes enterprise con requisitos regulatorios.

Riesgos:

- Alto costo de operación.
- Provisioning, backups y observabilidad mucho más complejos.
- No es eficiente para un SaaS masivo de entrada.

## Decisión

Se selecciona `shared database + shared schema + tenant_id` como estrategia principal.

Razones:

- Escala mejor para el escenario objetivo de miles de empresas.
- Reduce fricción operativa en el arranque.
- Hace más eficiente el uso de PostgreSQL, Redis y BullMQ.
- Permite construir analítica global del proveedor SaaS.

## Endurecimiento de aislamiento

- Toda entidad de negocio incluye `companyId`.
- Guards y contexto de tenant obligatorios en backend.
- Índices compuestos por `companyId`.
- Auditoría con trazabilidad por usuario y empresa.
- Ruta evolutiva híbrida: tenants enterprise pueden migrar a schema o DB dedicada.

## Arquitectura de alto nivel

### Frontend

- Next.js App Router.
- Landing pública separada del dashboard privado.
- TanStack Query para lecturas remotas.
- Zustand para estado de UI y POS temporal.
- React Hook Form + Zod para formularios.

### Backend

- NestJS modular por dominio.
- Clean Architecture ligera:
  - `domain`: reglas y contratos.
  - `application`: casos de uso.
  - `infrastructure`: Prisma, colas, cache, webhooks.
  - `presentation`: controllers, DTOs, guards.
- JWT + refresh tokens.
- RBAC con roles del sistema y permisos granulares.
- Prisma ORM sobre PostgreSQL.
- Redis para cache, rate limiting y colas.
- BullMQ para procesos asíncronos.

### Infraestructura

- Docker para desarrollo local.
- Nginx como reverse proxy en despliegue.
- Kubernetes para despliegues escalables.
- S3 para archivos e imágenes.
- Observabilidad con logs estructurados y trazas.

## Límites de dominio

- `auth`
- `companies`
- `plans`
- `subscriptions`
- `payments`
- `products`
- `inventory`
- `sales`
- `customers`
- `employees`
- `reports`
- `dashboard`
- `audit`

## Flujos críticos

### Alta de empresa

1. Usuario crea cuenta.
2. Registra empresa.
3. Selecciona plan.
4. Se crea suscripción pendiente.
5. Pasarela procesa el pago.
6. Webhook confirma transacción.
7. Empresa queda activa.

### Venta POS

1. Cajero abre carrito.
2. Agrega productos con precio y stock vigentes.
3. Se valida disponibilidad.
4. Se registra la venta y sus items en transacción.
5. Se descuenta inventario.
6. Se genera ticket y auditoría.

## Escalabilidad

- Índices compuestos y partición futura de `sales` por fecha.
- Caché por tenant para catálogos y dashboard.
- Paginación cursor-based en listados pesados.
- Colas para facturación, exportaciones, notificaciones y webhooks.
- Read models para reportes agregados.

## Seguridad

- Access token corto.
- Refresh token rotativo con revocación.
- Hash de contraseñas con Argon2.
- Rate limiting por IP y por tenant.
- Validación de payloads con Zod y DTOs.
- Sanitización y serialización de salida.
- Auditoría de acciones sensibles.

