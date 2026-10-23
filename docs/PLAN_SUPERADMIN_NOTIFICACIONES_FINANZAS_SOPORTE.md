# Plan: Notificaciones Super Admin, Módulo de Finanzas Plataforma, Consumo de APIs/Tokens y Soporte Enlazado

**Fecha:** 2026-10-25

**Objetivo:** Centralizar notificaciones hacia el Super Admin, crear un módulo de finanzas exclusivo para él, llevar contabilidad de pagos/compras de APIs, medir consumo de tokens de APIs por empresa y enlazar el soporte para que COMPANY_ADMIN no quede sin respuesta.

**Regla vigente:** Integración de las tres ramas feature en `main` y push autorizados por el usuario, después de verificar tipos, pruebas y builds.

## 1) Análisis actual

- Notificaciones: existe módulo pero falta notificar a todos los SUPER_ADMIN por eventos de plataforma.
- Suscripciones / PlanUpgradeRequest: falta notificar a Super Admin al crear/actualizar y al subir comprobante.
- Soporte: falta asignación a SUPER_ADMIN/SUPPORT_ADMIN y bandeja unificada.
- Finanzas plataforma: inexistente.

## 2) Objetivos funcionales

- Notificaciones a Super Admin (cambio de plan, por vencer, pago/comprobante, tickets/chats).
- Alerta a empresa cuando su suscripción esté por vencer.
- Módulo Finanzas Plataforma (solo Super Admin): ingresos/egresos, saldo, proveedores API, facturas.
- Consumo de APIs/Tokens por empresa, facturable y contabilizable.
- Soporte enlazado (asignación) para atención "real".
- UI/UX exclusivo Super Admin.

## 3) BD (aditivo)

- Notification: scope (COMPANY|PLATFORM), globalTarget (SUPER_ADMINS).
- PlatformAccount, PlatformTransaction (INCOME/EXPENSE/ADJUSTMENT, PENDING/PAID/REJECTED/CANCELLED).
- ApiProvider, ApiUsageRecord (tokens, costo, `billed`, vínculo a transacción).
- SupportTicket/SupportConversation: `assignedToId`, `assignedAt`, `firstResponseAt`.

## 4) Backend

- NotificationsService.notifySuperAdmins()
- Disparar en PlanUpgradeRequest create/review y subida de comprobante
- Cron subscription-expiring/expired (Super Admin + empresa)
- platform-finance module (guards solo SUPER_ADMIN)
- Soporte: endpoints de asignación + notificaciones

## 5) Frontend (exclusivo Super Admin)

- Navegación plataforma: Finanzas, Uso de APIs, Soporte (unificado)
- Campana con agrupación Plataforma/Empresa
- /platform/finanzas (resumen, ingresos, egresos, por empresa, proveedores)
- /platform/api-usage (consumo, facturar)
- /platform/support (sin asignar/asignados/todos)

## 6) Fases

- A: Backend notificaciones/suscripciones
- B: Backend finanzas + API usage
- C: Backend soporte asignación
- D: Frontend notificaciones/navegación
- E: Frontend finanzas/API usage
- F: Frontend soporte unificado
- G: Integración/QA

## 7) Reglas

- Publicar commits únicamente con autorización del usuario
- Migraciones aditivas
- Guards estrictos por globalRole === 'SUPER_ADMIN'
- AuditLog en acciones sensibles
- Facturación de consumo sin duplicados

## 8) Integración implementada

- Finanzas exclusivas de SUPER_ADMIN: cuentas, movimientos manuales, resumen por moneda, serie de seis meses y pagos de suscripciones por empresa.
- APIs: catálogo de proveedores, tarifa por unidad, registros detallados y agregados mensuales por empresa. Contabilización de costos como egresos atómica, con protección frente a reintentos y solicitudes concurrentes.
- Soporte de plataforma sin tenant: bandeja de tickets y chats, filtros todos/sin asignar/asignados a mí, responsables activos de plataforma, respuestas y estados. Las notas internas no se exponen a empresas.
- Notificaciones personales de plataforma: cada administrador recibe su copia y conserva su propio estado de lectura. Nuevos eventos de cambio de plan, comprobante y revisión; alertas de vencimiento para empresa y SUPER_ADMIN a las 07:00 de Lima.
- Rutas: `/platform/finanzas`, `/platform/api-usage`, `/platform/support`, `/platform/notifications`.
- Migraciones aditivas de finanzas/APIs, marcas de asignación y vínculo contable de consumo.

### Alcance contable y pendientes del diseño ampliado

- La contabilización de consumo registra el costo del proveedor como egreso; no emite comprobantes tributarios ni cobra automáticamente a empresas.
- Los estados PENDING/PAID/REJECTED/CANCELLED, ajustes contables y adjuntos de facturas de proveedores siguen siendo ampliaciones del diseño inicial. Los movimientos actuales representan operaciones registradas.
- Los tokens detallados se registran mediante el endpoint administrativo; el contador automático existente de solicitudes se conserva. La instrumentación específica de cada API externa depende de su integración.
- La validación visual y los recorridos con sesiones reales de cada rol deben realizarse en el navegador.

### Verificación realizada

- TypeScript backend (`tsc --noEmit --ignoreDeprecations 6.0`) y frontend (`tsc --noEmit`) sin errores.
- Suite existente: 151 pruebas aprobadas. Nuevas pruebas específicas: 11 aprobadas.
- Build de producción de Next.js aprobado con las cuatro nuevas rutas dinámicas.
- Prisma: schema validado y migraciones aplicadas. Consulta de lectura real de resumen financiero, resumen API y campos de soporte aprobada.
- Formato del backend completo aprobado; formato de los archivos frontend modificados revisado con Prettier.
