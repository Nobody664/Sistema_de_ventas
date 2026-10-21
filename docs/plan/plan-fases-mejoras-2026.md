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

## Fase 2 — Exports reales (xlsx/PDF) ⬜
*Esfuerzo: 1 día · Impacto: ALTO (funcionalidad mal entregada)*

Hoy `format=excel` devuelve JSON y `format=pdf` devuelve HTML con extensión cambiada (`docs/sistema/backend/products.md`).

- 2.1 Instalar `exceljs` (xlsx real) y `pdfkit` (PDF real).
- 2.2 `ProductsService.exportProducts` → CSV / XLSX / PDF reales.
- 2.3 `SalesService.exportSales` → CSV / XLSX / PDF reales.
- 2.4 Verificar descarga en frontend (`{ filename, contentType, data }` base64) — sin cambios esperados en cliente.
- 2.5 Tests unitarios del generador.

## Fase 3 — BullMQ: emails asíncronos ⬜
*Esfuerzo: medio · Impacto: MEDIA-ALTA (latencia de requests y fiabilidad)*

`@nestjs/bullmq` está instalado y `BullModule.forRoot` condicional, pero **no existe ninguna cola**; los emails se envían síncronos con nodemailer dentro de requests.

- 3.1 Registrar cola `email` (`registerQueue`) + `EmailProcessor` (`WorkerHost`).
- 3.2 `EmailService` → `add()` a la cola; fallback síncrono si no hay `REDIS_URL`.
- 3.3 Reintentos/backoff configurados; log de fallos.
- 3.4 Tests del processor con mock de cola.

## Fase 4 — Pagos: Yape/Plin y providers ✅
*Esfuerzo: medio-alto · Impacto: MEDIA*

- 4.1 Yape: hoy son instrucciones hardcodeadas ("Transfer to Yape number: 999888777") → servir desde `PaymentSetting` (QR + número reales del super-admin). ✅ (resuelto en Fase 1.4)
- 4.2 Flujos manuales (Yape/Plin/transferencia) validados contra `PaymentSetting.isEnabled`. ✅ (`createCheckoutSession` + checkout/upgrade ya usaban settings)
- 4.3 Dejar Stripe/PayPal documentados como no soportados (respuesta clara 501) en vez de `pending` silencioso. ✅ `NotImplementedException`

## Fase 5 — SSE multi-instancia (Redis pub/sub) ⬜
*Esfuerzo: medio · Impacto: MEDIA (requerido para escalar >1 instancia)*

`NotificationsService` usa un `Map` in-process de suscriptores SSE.

- 5.1 Publicar eventos de notificación en canal Redis (`notifications:{userId}`).
- 5.2 Suscripción Redis en cada instancia → fan-out a sus suscriptores locales.
- 5.3 Fallback in-process si no hay Redis (comportamiento actual).

## Fase 6 — Tests: e2e y cobertura de servicios clave ⬜
*Esfuerzo: alto · Impacto: MEDIO-ALTO (seguridad de futuros cambios)*

- 6.1 Infra e2e: `@nestjs/testing` + `supertest`, setup con DB de prueba (o mocks de Prisma).
- 6.2 E2E críticos: auth (login/refresh/rotación), sales, payments webhook idempotente.
- 6.3 Unit tests de servicios sin cubrir: `auth`, `subscriptions`, `billing`, `kardex` (FIFO/ponderado), `plan-capabilities`.

## Fase 7 — Checklists manuales Rounds 3–7 ⬜
*Requiere server + DB + Redis corriendo*

- 7.1 Ejecutar checklist Round 7 (imágenes) — `docs/guias/guia-pruebas-correcciones.md`.
- 7.2 Ejecutar checklists Rounds 3–6 (CSRF, idempotencia, vencimientos, boletas).
- 7.3 Marcar ítems verificados y anotar hallazgos/correcciones.

## Fase 8 — Módulo de soporte / chat ⬜
*Esfuerzo: alto · Feature nueva · Impacto: ALTO para clientes*

Plan: `docs/plan/plan-modulo-soporte-chat-integrado-2026-03-19.md`

- 8.1 Schema: `SupportTicket`, `SupportMessage` (+ migración).
- 8.2 Backend: módulo `support` (tickets CRUD, mensajes, SSE propio o reuso de notificaciones).
- 8.3 Frontend: panel de tickets en dashboard + backoffice `/platform/support`.
- 8.4 Notificaciones/email al responder.

## Fase 9 — Módulo de proveedores y órdenes de compra ⬜
*Esfuerzo: alto · Feature nueva · Impacto: MEDIO-ALTO*

Plan: `docs/plan/plan-modulo-proveedores-ordenes-automaticas-2026-03-20.md`

- 9.1 Schema: `Supplier`, `PurchaseOrder`, `PurchaseOrderItem` (+ migración).
- 9.2 Backend: CRUD proveedores, órdenes, recepción → `StockEntry`.
- 9.3 Sugerencias automáticas desde `ReplenishmentService` → borrador de orden.
- 9.4 Frontend: `/suppliers`, `/purchase-orders`.

## Fase 10 — Pendientes de `plan-mejoras.md` ⬜
*Impacto: MEDIO · El más largo al final*

- 10.1 Métricas de dashboard: ventas por período, ticket promedio, top productos, rotación (endpoint agregado + widgets).
- 10.2 Búsqueda DNI/RUC con autocompletado en frontend (el backend `dni` ya existe con cuota).
- 10.3 Notas de crédito/débito por devolución.
- 10.4 Reportes PDF/Excel de inventario y clientes (reutiliza Fase 2).

---

## Criterio de verificación por fase

```powershell
cd backend;  npm run lint; npm test; npx prettier --check "src/**/*.ts"
cd frontend; npm run lint
git add -A; git commit -m "<fase>: <resumen>"; git push
```
