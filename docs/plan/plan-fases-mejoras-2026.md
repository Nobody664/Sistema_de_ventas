# Plan por Fases – Mejoras del Sistema (2026-10-20)

Plan maestro con las 13 tareas pendientes priorizadas: **de mayor impacto a menor**, ejecutándose **de lo más fácil a lo más pesado**. Cada fase termina con verificación (`lint` + `test` + `format`) y commit.

Estado: `⬜` pendiente · `✅` completada · `🔶` parcial

---

## Fase 1 — Higiene y correcciones rápidas ✅
*Esfuerzo: horas · Riesgo: bajo*

| # | Tarea | Estado |
|---|-------|--------|
| 1.1 | `prettier --write` repo-wide (el `npm run format` falla en ~40 archivos preexistentes) | ✅ backend + 208 archivos frontend |
| 1.2 | Eliminar `backend/prisma/migration.sql` (dump huérfano de 20 tablas, obsoleto y confuso) | ✅ |
| 1.3 | URLs placeholder en emails (`https://ventas.example.com/...` en `email.service.ts`) → usar `APP_URL`/env | ✅ `FRONTEND_URL` + `{{signInUrl}}`; también templates `TRIAL_*` (los trial emails usaban WELCOME y perdían el `{{message}}`) |
| 1.4 | MercadoPago checkout usa `payment_method_id: 'yape'` hardcodeado (`payments.service.ts`) → corregir o eliminar | ✅ migrado a **Preference (Checkout Pro)** con SDK v2; providers manuales (yape/plin/transfer) sirven desde `PaymentSetting`; no soportados → `501` |

## Fase 2 — Exports reales (xlsx/PDF) ✅
*Esfuerzo: 1 día · Impacto: ALTO (funcionalidad mal entregada)*

Antes `format=excel` devolvía JSON y `format=pdf` devolvía HTML con extensión cambiada.

- 2.1 `exceljs` y `pdfkit` (+ `@types/pdfkit`) instalados. ✅
- 2.2 `ProductsService.exportProducts` → CSV / XLSX / PDF reales. ✅
- 2.3 `SalesService.exportSales` → CSV / XLSX / PDF reales. ✅
- 2.4 Helper compartido `common/helpers/export.helper.ts` (`buildCsvExport`, `buildXlsxExport`, `buildPdfExport`); misma forma `{ filename, contentType, data }` base64, sin cambios en el cliente. ✅
- 2.5 Tests `export.helper.spec.ts` (6 casos: BOM/escape CSV, magic bytes `PK` y `%PDF-`, paginación, dataset vacío). ✅ suite 86/86

## Fase 3 — BullMQ: emails asíncronos ✅
*Esfuerzo: medio · Impacto: MEDIA-ALTA (latencia de requests y fiabilidad)*

`@nestjs/bullmq` estaba instalado y `BullModule.forRoot` condicional, pero no existía ninguna cola; los emails se enviaban síncronos.

- 3.1 Cola `email` (`registerQueue`) + `EmailProcessor` (`WorkerHost`) registrados cuando hay `REDIS_URL`. ✅
- 3.2 `EmailService.sendEmail` → `add()` a la cola; fallback síncrono (`sendEmailDirect`) sin Redis o si `add()` falla. Helpers de envío migrados a `sendEmail`. ✅
- 3.3 Reintentos: `attempts: 3`, backoff exponencial 5 s, `removeOnComplete/Fail` acotados; los errores SMTP se propagan para que BullMQ reintente. ✅
- 3.4 Tests `email.processor.spec.ts` (delegación + propagación de errores). ✅ suite 88/88

## Fase 4 — Pagos: Yape/Plin y providers ✅
*Esfuerzo: medio-alto · Impacto: MEDIA*

- 4.1 Yape: hoy son instrucciones hardcodeadas ("Transfer to Yape number: 999888777") → servir desde `PaymentSetting` (QR + número reales del super-admin). ✅ (resuelto en Fase 1.4)
- 4.2 Flujos manuales (Yape/Plin/transferencia) validados contra `PaymentSetting.isEnabled`. ✅ (`createCheckoutSession` + checkout/upgrade ya usaban settings)
- 4.3 Dejar Stripe/PayPal documentados como no soportados (respuesta clara 501) en vez de `pending` silencioso. ✅ `NotImplementedException`

## Fase 5 — SSE multi-instancia (Redis pub/sub) ✅
*Esfuerzo: medio · Impacto: MEDIA (requerido para escalar >1 instancia)*

`NotificationsService` usaba un `Map` in-process de suscriptores SSE (una instancia no veía a las demás).

- 5.1 `create` publica el evento en el canal Redis `notifications:events` (`publishNotification`). ✅
- 5.2 Cada instancia se suscribe (`onModuleInit` con `duplicate()`) y hace fan-out a sus clientes SSE locales (`onPubSubMessage`). ✅
- 5.3 Fallback in-process si no hay Redis, si falla la suscripción o si `publish` falla. ✅
- 5.4 Tests `notifications.service.spec.ts` ampliados (pub/sub, fallback, payload inválido). ✅ suite 92/92

## Fase 6 — Tests: e2e y cobertura de servicios clave ✅
*Esfuerzo: alto · Impacto: MEDIO-ALTO (seguridad de futuros cambios)*

- 6.1 Infra e2e: se descarta montar `@nestjs/testing` + `supertest` con DB real (fuera del alcance del repo: no hay contenedor de Postgres en CI y el runner es `node:test`). En su lugar se amplía la cobertura **por capas** con dobles de Prisma y guards sobre `Request`/`Response`. ✅
- 6.2 E2E "de borde": auth (login/refresh/rotación) a nivel de servicio con dobles de Prisma/JwtService; sales/payments ya cubiertos a nivel servicio. ✅
- 6.3 Unit tests de los servicios de plataforma sin cubrir: `auth` (8), `subscriptions` (8), `billing` (5), `plan-capabilities` (7) y kardex costeo (6). ✅ suite 126/126

## Fase 7 — Checklists manuales Rounds 3–7 ⬜
*Requiere server + DB + Redis corriendo*

- 7.1 Ejecutar checklist Round 7 (imágenes) — `docs/guias/guia-pruebas-correcciones.md`.
- 7.2 Ejecutar checklists Rounds 3–6 (CSRF, idempotencia, vencimientos, boletas).
- 7.3 Marcar ítems verificados y anotar hallazgos/correcciones.

## Fase 8 — Módulo de soporte / chat ✅
*Esfuerzo: alto · Feature nueva · Impacto: ALTO para clientes*

Plan: `docs/plan/plan-modulo-soporte-chat-integrado-2026-03-19.md`

- 8.1 Schema: `SupportTicket`, `SupportMessage` (+ migración). ✅ modelos/enums de tickets, comentarios, historial, conversaciones/participantes/mensajes, categorías y FAQ; migración `20261020000000_add_support_module` (RLS por tabla) aplicada (16ª).
- 8.2 Backend: módulo `support` (tickets CRUD, mensajes, SSE propio o reuso de notificaciones). ✅ `support-tickets.service`, `support-chat.service`, `support-faq.service` + controllers; permisos `SUPPORT_*`; SLA por prioridad; notificaciones reusando `NotificationsModule`; `PermissionsGuard` añadido a los tres controllers. Test `support-tickets.service.spec.ts` (5). Suite 131/131.
- 8.3 Frontend: panel de tickets en dashboard + backoffice `/platform/support`. ✅ dashboard `/support` (hub con métricas), `/support/tickets` (lista, nuevo, detalle con estados/comentarios), `/support/chat` (lista, nueva, conversación con polling y convertir a ticket) y `/support/faqs` (buscador + feedback). Permisos `support:*` añadidos a `types/permissions.ts` y nav "Soporte" en el sidebar. Backoffice `/platform/support` queda pendiente (subset del plan).
- 8.4 Notificaciones/email al responder. ✅ notificación in-app a agentes (nuevo ticket), al solicitante (respuesta/estado) y a participantes (chat).

## Fase 9 — Módulo de proveedores y órdenes de compra ✅
*Esfuerzo: alto · Feature nueva · Impacto: MEDIO-ALTO*

Plan: `docs/plan/plan-modulo-proveedores-ordenes-automaticas-2026-03-20.md`

- 9.1 Schema: `Supplier`, `PurchaseOrder`, `PurchaseOrderItem` (+ migración). ✅ modelos `Supplier`, `SupplierProduct` (pivote preferido/costo), `SupplierOrder`, `SupplierOrderItem` + enum `SupplierOrderStatus`; migración `20261021000000_add_suppliers_orders` (RLS por tabla) aplicada (17ª). Nota: se implementó como `SupplierOrder` en lugar de `PurchaseOrder`.
- 9.2 Backend: CRUD proveedores, órdenes, recepción → `StockEntry`. ✅ `suppliers.controller/service` (CRUD, asignación de productos con preferido/cantidad mínima, órdenes manuales, cambio de estado, recepción que crea `StockEntry` y actualiza `lastCost`); permisos `SUPPLIER_*`/`SUPPLIER_ORDER_*`; `suppliers.service.spec.ts` (7). Suite 138/138.
- 9.3 Sugerencias automáticas desde `ReplenishmentService` → borrador de orden. ✅ `getAutoOrdersPreview` agrupa productos con stock ≤ mínimo por proveedor preferido (cantidad sugerida = max(faltante, mín. pedido)) y `generateAutoOrders` crea órdenes `DRAFT` auto-generadas, listando los productos sin proveedor asignado.
- 9.4 Frontend: `/suppliers`, `/purchase-orders`. ✅ `/suppliers` (lista + métricas, alta/edición, detalle con gestión de productos), `/purchase-orders` (lista + panel de sugerencias automáticas y generación, detalle con cambio de estado y recepción con costos). Permisos `supplier:*`/`supplier_order:*` y nav en el sidebar.

## Fase 10 — Pendientes de `plan-mejoras.md` ⬜
*Impacto: MEDIO · El más largo al final*

- 10.1 Métricas de dashboard: ventas por período, ticket promedio, top productos, rotación (endpoint agregado + widgets). ✅ endpoint agregado `GET /dashboard/metrics?days&granularity` (resumen del período + comparativa con el período anterior, serie temporal día/semana/mes, top productos e índice de rotación por producto); panel `DashboardMetricsPanel` con selector 7/30/90/365 días, gráfico de ingresos, tiles con variación % y tabla de rotación, integrado en el dashboard de tenants.
- 10.2 Búsqueda DNI/RUC con autocompletado en frontend (el backend `dni` ya existe con cuota). ✅ `DniService` ahora cachea resultados (DNI/RUC, TTL 24h) reutilizando `CacheService`; `DniSearch` autocompleta al alcanzar la longitud válida (debounce 350ms) además del botón manual; validaciones peruanas compartidas en `lib/validations/pe-document.ts` (DNI 8, RUC 11 + dígito verificador, teléfono y email) integradas al esquema de clientes.
- 10.3 Notas de crédito/débito por devolución.
- 10.4 Reportes PDF/Excel de inventario y clientes (reutiliza Fase 2).

---

## Criterio de verificación por fase

```powershell
cd backend;  npm run lint; npm test; npx prettier --check "src/**/*.ts"
cd frontend; npm run lint
git add -A; git commit -m "<fase>: <resumen>"; git push
```
