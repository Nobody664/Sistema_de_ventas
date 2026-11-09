# Implementación: contexto y espacio administrativo

## Entrega

La base de las fases 1 y 2 está implementada en la rama `arquitectura/01-02-contexto-espacio-administrativo`. Las fases 3–6 conservan su alcance en el plan de integración.

- `GET /store-admin/context`: resuelve empresa y membresía activa de `COMPANY_ADMIN` desde la sesión. Los permisos globales no crean contexto de dueño. Mantiene `store:manage`.
- `MANAGE`: empresa `ACTIVE`/`TRIAL` con módulo `storefront`. Una tienda deshabilitada puede configurarse para habilitarla.
- `CLOSEOUT`: conserva atención de pedidos existentes. No permite abrir resumen, catálogo ni configuración desde el espacio nuevo. El dashboard responde 403.
- `GET /store-admin/dashboard`: últimos siete días calendario por defecto; máximo 90. `from` incluye el día inicial y `to` excluye el día final, ambos en la zona horaria de la empresa. `range.toKey` identifica el último día incluido.
- Las ventas se filtran por `Sale.createdAt`, `channel=ONLINE`, `status=COMPLETED` y vínculo al pedido. La fecha de creación del pedido no sustituye la fecha de venta. Los pendientes actuales no se restringen al período del resumen.
- `GET /store-admin/orders?page=N` conserva el array legado. `queue`, `status`, `paymentStatus`, `fulfillment`, `q`, `limit` o `cursor` activan el envelope nuevo. El cursor se vincula a empresa/filtros y ordena por fecha e identificador descendentes. `totals.matched` no disminuye al avanzar de página.
- El detalle administrativo añade `allowedActions`. Los comandos mantienen sus validaciones autoritativas; el portal del comprador no recibe este campo.

## Frontend

- `/comercio` decide entre resumen y atención restringida usando contexto del servidor.
- Shell independiente con navegación responsive, selector de módulo, retorno a Gestión, tema, campana existente y enlace al catálogo público. Reutiliza los proveedores raíz sin añadir otra conexión de notificaciones.
- `/comercio/resumen` consume agregados del servidor con período seleccionable, estado vacío, actualización y recuperación de errores.
- Rutas de pedidos, pagos, entregas, catálogo, clientes y configuración adaptan los componentes existentes. Los formularios de pago, entrega y reglas tienen entradas separadas. La extracción de bandejas y componentes operativos nuevos continúa en las fases 3 y 4.
- `/comercio/pedidos/:id` y `/comercio/atencion/pedidos/:id` abren el detalle existente.
- `/store` y `/atencion-tienda` redirigen al espacio nuevo fuera del layout general que bloquea empresas restringidas.
- Claves Query con empresa/usuario/período. Las mutaciones administrativas invalidan el contexto/resumen; las consultas periódicas y al recuperar foco reconcilian los agregados. La invalidación específica por evento SSE corresponde a la fase 3.

## Verificación

- Suite completa del backend, incluidas compras, reservas, pagos, migraciones y notificaciones: aprobada.
- Integración HTTP con Prisma y PostgreSQL embebido: 35 pedidos de fixture, paginación 30+5, total estable, medianoche de Lima, venta de un pedido creado fuera del período, venta reembolsada excluida, comprador/plataforma rechazados, empresa suspendida y membresía revocada.
- Suite frontend: 111 pruebas aprobadas.
- TypeScript de ambos proyectos y build de producción de Next.js: aprobados.
- `npm run test:browser:commerce`: Chromium con backend de fixtures; alias antiguos, recarga profunda, formularios por sección, modos de acceso, recuperación tras 503 y anchos 320/390/768/1440.

## Medición pendiente de despliegue

No se añadieron índices ni migraciones comerciales sin evidencia de volumen. El análisis EXPLAIN con un dataset representativo del negocio y la medición en entorno de despliegue siguen pendientes. Las pruebas de fixtures y PostgreSQL embebido verifican integridad, no acreditan rendimiento de producción.
