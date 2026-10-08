# Registro de errores

Bitácora de errores relevantes del proyecto con causa y corrección.

---

## 2026-10-08 — Deploy Render: sin puerto expuesto, pooler transaccional y `ParseEnumPipe`

> Primer deploy tras las migraciones de round 4 (`idempotency_key`, únicos en `payments`).
> Estado: **resuelto** — deploy `612fced` quedó **live** en Render; `/api/health/ready` responde 200.

| Error / síntoma | Causa | Corrección / verificación |
|-----------------|-------|---------------------------|
| `No open ports detected... Port scan timeout reached` repetido tras `Running 'bash ./start.sh'` | El proceso de Node no llegaba a `app.listen` porque el boot abortaba por un pipe mal registrado: `Nest can't resolve dependencies of the ParseEnumPipe (?, Object)` | Los logs de la app mostraban la excepción real. Corregido instanciando el pipe: `@Param('provider', new ParseEnumPipe(PaymentProvider))` en `payment-settings.controller.ts` (líneas 44 y 53). Verificado: `npm run lint` OK y deploy `live` con `Server running on port 10000` |
| `Datasource "db": PostgreSQL ... at "aws-0-sa-east-1.pooler.supabase.com:6543"` en el `migrate deploy` | `DATABASE_URL`/`DIRECT_URL` apuntaban al pooler **transaccional (6543)**. Los driver adapters de Prisma usan prepared statements, incompatibles con pgbouncer en modo transaccional → fallos en runtime | Configurar ambas env vars en Render con el pooler de **sesión (5432)**, tal como advierte `render.yaml`. Verificado: el deploy posterior conectó a `5432` y aplicó las migraciones sin error |
| `ParseEnumPipe` no podía instanciarse en bootstrap | Se usaba la referencia de clase (`ParseEnumPipe`) en el decorador de parámetro. A diferencia de `ParseIntPipe` (con `@Optional()` en sus opciones), `ParseEnumPipe` exige el `enumType` en el constructor y Nest intentaba inyectarlo vía DI | `new ParseEnumPipe(PaymentProvider)`. Ejemplo canónico que NO se puede emular como referencia de clase |
| Los logs del deploy se cortaban antes de `Server running` | El arranque abortaba en la fase de validación de dependencias de Nest (no era un cuelgue de infra) | Confirmado el arranque completo en logs: rutas mapeadas, `CacheService` con fallback local y `Server running on port 10000` |

**Log crudo del deploy (pegado tal cual):**

```
12:48:38 AM
==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
12:48:38 AM
==> Port scan timeout reached, no open ports detected. Bind your service to at least one port. If you don't need to receive traffic on any port, create a background worker instead.
12:48:23 AM
==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
12:48:23 AM
==> No open ports detected, continuing to scan...
12:47:22 AM
==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
12:47:22 AM
==> No open ports detected, continuing to scan...
Menu
12:46:21 AM
==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
12:46:21 AM
==> No open ports detected, continuing to scan...
12:45:20 AM
==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
12:45:20 AM
==> No open ports detected, continuing to scan...
12:44:19 AM
==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
12:44:19 AM
==> No open ports detected, continuing to scan...
12:43:53 AM
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-0-sa-east-1.pooler.supabase.com:6543"
12:43:53 AM
Prisma schema loaded from prisma/schema.prisma.
12:43:52 AM
12:43:52 AM
Loaded Prisma config from prisma.config.ts.
12:43:39 AM
=== Applying pending migrations (baseline) ===
12:43:39 AM
==> Running 'bash ./start.sh'
12:43:16 AM
==> Setting WEB_CONCURRENCY=1 by default, based on available CPUs in the instance
12:43:16 AM
==> Deploying...
12:43:15 AM
==> Build successful 🎉
12:43:15 AM
==> Uploaded in 5.1s. Compression took 3.0s
12:43:07 AM
==> Uploading build...
12:43:06 AM
=== Build complete ===
12:43:02 AM
12:43:02 AM
> tsc && tsc-alias
12:43:02 AM
> backend@0.1.0 build
```

---

## 2026-10-06 — Correcciones de seguridad y aislamiento de tenant

| Error | Causa | Corrección |
|-------|-------|------------|
| `500 Cannot access 'sale' before initialization` en toda venta | `sales.service.ts` usaba `sale.saleNumber` dentro del callback de `$transaction` antes de que el `let`/`const` `sale` existiera (TDZ) | Usar la variable `saleNumber` (ya calculada antes de la transacción). Regresión cubierta por suite |
| `GET /invoices/generate/:id` devolvía 200 para ventas de otra empresa | La venta se buscaba solo por `id`, sin `companyId` | `sale.findFirst({ where: { id, companyId } })` → 404 para otra empresa |
| `POST /products` con `categoryId` de otra empresa creaba el producto | `ensureCategory` buscaba la categoría solo por `id` | `category.findFirst({ where: { id, companyId } })` → 404 |
| Comprobante de pago legible por cualquier usuario autenticado | `getProofById` no validaba la empresa de la suscripción | Incluir `subscription.companyId` y 404 si no coincide con la del llamador |
| `POST /payments/checkout/requests` recibía la identidad desde el body | `@Body() body: any`, `companyId` viajaba en el payload | Guard opcional por JWT + inyección de `companyId` desde la sesión + DTO con whitelist |
| Subir/leer comprobantes (`proof`) sin autenticar | Endpoints marcados `@Public()` en `payment-settings` | Requieren JWT y validan que la suscripción pertenezca a la empresa (404 cruzando tenant) |
| `TenantGuard` dejaba ver "todo" a superadmin sin `companyId` | `return true` antes de fijar `tenantId` ⇒ `undefined` = sin filtro en Prisma | Lanzar 403 "Tenant context is required for this resource." |
| Checkout: pago `paymentMethod` en minúsculas rechazado | La validación manual corría antes que el `toUpperCase()` | `@Transform` a mayúsculas en el DTO antes de `@IsEnum` |
| `review` de checkout registraba `reviewerId` `undefined` | El controller pasaba `user.id`, pero el JWT expone `sub` | Pasar `user.sub` |

### Auditoría de seguridad end-to-end (round 2)

| Error | Causa | Corrección |
|-------|-------|------------|
| Webhook `POST /payments/webhooks/:provider` activaba suscripciones sin validar origen | `handleWebhook` confiaba en el payload (`status:'approved'`) y no verificaba firma; ni `await` | Validar `X-Signature` (HMAC-SHA256 sobre `<data.id>.<ts>`) con `MERCADOPAGO_WEBHOOK_SECRET`; sin secreto o firma inválida → 401. `activateSubscription` ahora `await`-ed e idempotente (rechaza `providerPaymentId` duplicado). Se eliminó `console.log(payload)` y el token MP hardcodeado |
| `@Roles(...)` sin efecto en 11 controladores (RBAC ficticio) | `RolesGuard` solo se aplicaba donde se importaba; no era global | Registrar `RolesGuard` como `APP_GUARD` en `app.module.ts` → todos los `@Roles` se cumplen |
| `plan-upgrade-requests`: `req.tenantId` siempre `undefined` (create/getMy rotos) y `submitProof` IDOR | El controller leía `req.tenantId` que solo setea `TenantGuard` (ausente) y no validaba pertenencia | Usar `@CurrentUser()` (`user.companyId`); `submitProof` compara `request.companyId` → 403 si no coincide; `review` usa `user.sub` |
| XSS almacenado en facturas | `buildInvoiceHtml` interpelaba campos sin escapar; frontend imprimía con `document.write` (bypasa CSP) | `escapeHtml` en todas las interpolaciones (empresa, cliente, items, N°, footer, logo); impresión con `<iframe srcdoc sandbox="allow-modals">` sin scripts |
| `PATCH /notifications/:id/read` marcaba notificaciones ajenas | El controller no recibía `@CurrentUser` | `markAsRead(id, userId)` con `findFirst({ id, userId })` → 404 si no es suya |
| `GET /debug/routes` y `POST /auth/test-public` públicos | Decoradores `@Public()` innecesarios | Eliminados → requieren JWT (401 sin sesión) |

### Round 3 — 5 mejoras del backlog

| Error / riesgo | Causa | Corrección |
|----------------|-------|------------|
| POST/updates vulnerables a CSRF vía form-POST cross-origin | Cualquier mutación aceptaba bodies `urlencoded`/`text/plain` (sin preflight) con cookies SameSite=None | `CsrfGuard` global: mutaciones exigen `Content-Type: application/json` → 403 en otro caso. `logout()` del frontend ahora envía `Content-Type: application/json` |
| `GET /payment-settings` público devolvía `config` (posibles secretos) y timestamps | El endpoint público usaba el mismo `getAllSettings()` del admin | Proyección pública `PaymentSettingsPublicResponseDto` (sin `config`/fechas); admin conserva la lectura completa autenticada |
| Comprobante de pago gigante o con payload malformado llegaba al service | `SubmitCheckoutProofDto` limitaba a 500 KB y `SubmitUpgradeProofDto` no limitaba | `@MaxLength(2_000_000)` + `@Matches(/^data:image\//)` en los 3 DTOs de proofs (corte temprano) |
| Inyección de headers vía email (CR/LF en companyName/planName) y mails de prueba con subject equivocado | `interpolateTemplate` insertaba el valor crudo; `sendEmail`/`sendEmailDirect` ignoraban el `subject` custom (`job.subject`), usando siempre `template.subject`; plantilla con mojibake | Saneo de valores interpolados (se eliminan CR/LF y controles); destinatario con CR/LF rechazado; se respeta `job.subject` (fallback al de la plantilla); corregida codificación en `PAYMENT_PROOF_RECEIVED` |
| `npm test` completo parecía colgado (>180 s) | El runner `node --test` con 11 specs de ts-node tarda 1-5 min en esta máquina (tuve que subir el timeout) | Usar timeout ≥600 s; si un suite no imprime, correr ese archivo solo (p. ej. `checkout-requests.controller.spec.ts` ~42 s) |
| Smoke E2E en vivo no arranca en este sandbox | Sin red a Redis/Supabase: Prisma `$connect` + Cache/BullMQ cuelgan el boot | Ejecutar el smoke con infra alcanzable (Redis + DB); aquí queda el checklist en la guía de pruebas §12 |

### Round 4 — idempotencia, llaves únicas y XSS

| Error / riesgo | Causa | Corrección |
|----------------|-------|------------|
| Doble submit creaba 2 solicitudes de checkout/upgrade | `CheckoutRequest` y `PlanUpgradeRequest` sin clave única de idempotencia | `idempotencyKey String? @unique` (migración aditiva) + creates `createOrReuse`: ante P2002 con key, devuelven la solicitud existente |
| Revisión doble activaba 2 suscripciones/pagos | `review`/`submitProof` hacían `update`/`create` sin verificar la transición de estado | Transiciones atómicas con `updateMany({ where: { id, status } })` + `count===0 → 409`; aprobación de comprobante dentro de `$transaction` |
| Escritos cruzando tenant por `id` (update/delete de producto, categoría, stock, cancelación de suscripción) | Queries por `id` sin `companyId`; el 404 solo se garantizaba en la lectura previa (TOCTOU) | `updateMany`/`deleteMany` con `{ id, companyId }` + chequeo de `count` en `products`, `inventory.adjustStock`, `subscriptions.cancelSubscription`; `reports` agrega `companyId` |
| XSS en el `fontFamily` de facturas dentro de `<style>` | `invoices.service` interpelaba `template.fontFamily` sin escapar | `esc(fontFamily)` en el `<style>` (escapa `<`, `>` y comillas) + `@Matches(/^[A-Za-z0-9 ,'"]*$/)` en el DTO |
| Export HTML de ventas/productos con XSS | CSV/HTML interpelaban `saleNumber`, cliente, método, nombre, SKU, categoría sin escapar | Helper `escapeHtml` en `sales.service` y `products.service` para todas las interpolaciones |
| `POST /invoices/templates` (no-global) creaba plantilla global | El controller pasaba `('', true, body)` (mismo que la ruta `templates/global`) | La ruta no-global pasa `(request.tenantId, false, body)` → plantilla de empresa |
| P2002 como 409 genérico sin decir qué campo | El filtro usaba `meta.target` solo para el código | P2002 → 409 con el campo en el mensaje si `meta.target` existe |
| Webhook MP duplicado podía insertar 2 pagos (carrera antes de la dedupe) | `activateSubscription` hacía `findFirst` y luego `create` sin atómico | `providerPaymentId`/`transactionId` con `@unique` + `create` tolerante a P2002 (si el pago ya existe, retorna sin duplicar ni re-notificar) |
| `markAsPaid` escribía por `id` y con `providerPaymentId` estilo `paid-${Date.now()}` (colisión en el mismo ms) | Actualización por `id` sin scope y sufijo no único | `updateMany({ id, subscription.companyId })` + ids únicos por pago (`paid-<id>`/`manual-<id>`); fallback webhook `mp-<subscription.id>` |

### Errores HTTP por código (filtro global)

| Código | Escenario típico |
|--------|------------------|
| 400 | Validación de DTO (whitelist) o petición malformada |
| 401 | Sesión ausente/inválida; guard opcional devuelto como invitado |
| 403 | Tenant bloqueado (suspendido / prueba vencida / moroso) o superadmin global sin `companyId` |
| 404 | Recurso inexistente **o** de otra empresa (no distingue para no filtrar) |
| 409 | Conflicto (duplicado P2002, FK violada P2003, método de pago no disponible) |
| 500 | Error interno; se loguea el stack y no se expone en producción |

---

## 2026-04-10 — Deploy Render: `TenantGuard` no resuelve `PrismaService`

> Histórico, resuelto en el código actual.

- **Error:** `Nest can't resolve dependencies of the TenantGuard (Reflector, ?)` al prender la app; fallaba al levantar `AuditModule`/instancia de guards.
- **Causa:** el módulo global que registraba `TenantGuard` no importaba el módulo de `PrismaService` (en esa versión, `AuditModule`).
- **Solución actual:** `AuditCommonModule` es `@Global()` e importa `PrismaModule` ⇒ `PrismaService` está disponible globalmente para cualquier guard inyectado. Ver `backend/src/common/services/audit.module.ts`.