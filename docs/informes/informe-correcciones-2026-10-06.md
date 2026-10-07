# Informe de correcciones — Sistema de Ventas

**Fecha:** 2026-10-06
**Estado:** backend compilando, servidor local arrancado, base de datos en estado baseline.

---

## 1. Estado general

| Item | Estado |
|------|--------|
| `backend` — `tsc --noEmit` | OK |
| `backend` — `npm run build` | OK |
| `backend` — servidor local (`:4000`) | Arrancado y respondiendo |
| `frontend` — `npm run lint` (tsc) | OK |
| `frontend` — `npm run build` | **No verificado** (build superó 10 min en local, revisar) |
| `prisma migrate status` | `Database schema is up to date!` (2 migraciones) |
| `prisma migrate diff` (config → schema) | Sin drift |
| Tests automatizados | **No existen** (ver §4) |

### Estado de Git

- Rama `main` sincronizada con `origin/main`.
- **Ya commiteado y pusheado** (`fc59ddf`): migraciones baseline + FKs, seeds separados, filtro de excepciones, `@HttpCode`, `.gitignore`/tsbuildinfo, `start.sh`.
- **Pendiente de commitear** (correcciones de seguridad de esta sesión):

```
M backend/src/modules/invoices/invoices.service.ts
M backend/src/modules/payments/checkout-requests.controller.ts
M backend/src/modules/payments/dto/checkout-requests.dto.ts
M backend/src/modules/payments/payment-settings.controller.ts
M backend/src/modules/payments/payment-settings.service.ts
M backend/src/modules/products/products.service.ts
M backend/src/modules/sales/sales.controller.ts
M backend/src/modules/sales/sales.service.ts
M frontend/app/checkout/page.tsx
?? backend/src/common/guards/optional-jwt-auth.guard.ts   (nuevo)
```

---

## 2. Qué se resolvió

### A. Base de datos, integridad e integridad FK (commit `fc59ddf`)

1. **Causa raíz de la ausencia de FK:** `backend/prisma/schema.prisma` usaba `relationMode = "prisma"`, por lo que Prisma **nunca creaba claves foráneas** (0 FKs emitidas). Cambiado a `relationMode = "foreignKeys"` → se generan 37 FKs.
2. **Migración baseline única:** `20261004000001_init_baseline` (squash: 24 tablas, 16 unique, 44 índices, 17 enums). La migración vieja `20260929020715_init_back` fue eliminada del disco y su fila borrada de `_prisma_migrations` solo con Prisma raw; luego registrada con `migrate resolve --applied`.
3. **Migración de FKs:** `20261004000002_add_foreign_keys` con 37 `ALTER TABLE ... ADD CONSTRAINT`.
   - Ambas reescritas **sin BOM**: `Out-File -Encoding utf8` de PowerShell 5.1 escribe BOM y Postgres falla con `syntax error at or near "﻿"`.
   - Antes de aplicar: auditoría anti-join = **0 huérfanos**.
   - Si un fallo por BOM dejó la migración registrada: se usó `migrate resolve --rolled-back` y se re-aplicó.
4. **Verificación de integridad (6/6):** FK inexistente → P2003; `category_id` inválido → P2003; `ON DELETE SET NULL` al borrar categoría → OK; borrar plan referenciado → P2003 (RESTRICT); cascade de empresa → 0 filas restantes; enum inválido → bloqueado.
5. **Despliegue:** `backend/start.sh` ejecuta `npx prisma migrate deploy` y seed base condicional (`SEED_ON_DEPLOY=true`).
6. **Seeds separados:**
   - `db:seed` → solo catálogo (4 planes), idempotente, **no borra**.
   - `db:seed:demo` → datos demo.
   - `db:reset:demo` → por defecto solo tenants demo (acme/nova) + 5 usuarios; `--all` (=`db:reset:all`) para wipe total.
   - Script `db:reset:seed` eliminado. Cadena `reset → seed → seed` verificada idempotente.
7. **Artefactos de build:** `.gitignore` ampliado (`*.tsbuildinfo`, `backend/node_modules/.prisma/`, `backend/generated/`) y `.tsbuildinfo` desindexados.

### B. HTTP y manejo de errores (commit `fc59ddf`)

8. **`@HttpCode(200)`** en `auth.controller`: `login`, `refresh`, `forgot-password`, `reset-password`, `change-password`, `logout`, `test-public` (antes devolvían 201). `register` queda 201. Verificado: login 201 → 200.
9. **Filtro global de excepciones** (`common/filters/all-exceptions.filter.ts`, registrado como `APP_FILTER`):
   - `P2000`→400, `P2002`→409, `P2003`→409, `P2011`→400, `P2014`→400, `P2025`→404, `P2034`→409.
   - `PrismaClientValidationError`→400.
   - Arreglos de validación preservados como array.
   - 5xx: oculta el mensaje en producción y loguea stack; 4xx en `warn`.
   - Verificado por HTTP (409/P2002, 404/P2025, 409/P2003).

### C. Seguridad y aislamiento multi-tenant (esta sesión, **sin commitear**)

10. **Fuga cross-tenant en productos (CONFIRMADA y explotable).** `createProduct`/`updateProduct` aceptaban un `categoryId` ajeno al tenant: ACME creó un producto con la categoría privada de NOVA (201) y se filtraba el nombre de esa categoría.
    - Corrección: `ensureCategory(companyId, input.categoryId)` en create y update.
    - Verificado: categoría de NOVA → **404**; categoría inexistente → **404**; categoría propia → **201**.
11. **Fuga cross-tenant en ventas.** `createSale` usaba `input.customerId` / `input.employeeId` sin validar pertenencia.
    - Corrección: `findFirst({ where: { id, companyId } })` + `NotFoundException`.
    - Verificado: cliente de NOVA → **404**; `employeeId` inválido → **404**; venta legítima → **201**.
12. **Fuga cross-tenant en facturas.** `generateInvoiceHtml` hacía `sale.findUnique({ where: { id } })`.
    - Corrección: `findFirst({ where: { id: saleId, companyId } })`.
    - Verificado: NOVA pidiendo factura de venta de ACME → **404**; factura propia → **200**.
13. **Identidad controlada por el cliente en el checkout (PUBLISHED).** `POST /payments/checkout/requests` y `POST .../proof` eran `@Public()` y confiaban en `body.companyId`.
    - Corrección: nuevo guard `common/guards/optional-jwt-auth.guard.ts` (`OptionalJwtAuthGuard`) + `@CurrentUser()`; la identidad sale del JWT, nunca del body.
    - `SubmitCheckoutProofDto.companyId` **eliminado** y el frontend (`app/checkout/page.tsx`) dejó de enviarlo.
    - Verificado:
      - invitado sin token y sin `companyId` → **201** (flujo guest OK);
      - sin sesión pero con `companyId` en el body → **401** (en create y en proof);
      - sesión válida con `companyId` propio → **201**.
14. **IDOR en comprobantes de pago.** `GET /payment-settings/proof/:proofId` exigía sesión pero **no** validaba tenant.
    - Corrección: scoping por `subscription.companyId`; SUPER_ADMIN / SUPPORT_ADMIN quedan como acceso global.
15. **Endpoint público que consultaba la BD.** Se eliminó `GET /api/sales/test` (era `@Public()` y hacía `prisma.sale.findMany`, con fallback `test-company-id`). El frontend no lo usaba.
    - Verificado: `GET /api/sales/test` → **401** (dejó de ser público); `/api/health/live` → 200.
16. **Bug preexistente que rompía TODAS las ventas (500).** En `sales.service.createSale`, el callback de `$transaction` referenciaba `sale.saleNumber` antes de que `const sale` se inicializara (TDZ) → `ReferenceError: Cannot access 'sale' before initialization`.
    - Corrección: usa la constante `saleNumber` ya declarada.
    - Verificado: venta legítima 500 → **201**.

### D. Auditorías realizadas sin hallar vulnerabilidad

- **SQL crudo:** ninguno en `backend/src` (todo parametrizado).
- **`input.companyId` en servicios:** `payments.service` (`createCheckoutSession`) recibe `request.tenantId` desde `TenantGuard`; `audit.service` y `notifications.service` reciben `companyId` de registros de BD o de parámetros derivados del servidor.
- **`TenantGuard`:** `tenantId` se deriva del JWT (`request.user.companyId`), no de cabeceras ni del body.
- **`employees.service.create`:** construye `data` manualmente e ignora `input.userId`.
- **`auth.register`:** crea su propia empresa.
- **DTOs con whitelist global** (`whitelist: true, forbidNonWhitelisted: true`): impiden mass-assignment de `companyId` en endpoints que usan DTO.
- Rutas `@Public()` revisadas una por una: `auth`, `health`, `plans` (catálogo), `payment-settings` (lectura de datos de cobro para checkout), `payments/webhooks`, `checkout-requests`, `debug/routes` (respuesta estática).

### E. Estado de datos

La base de datos fue **restaurada al baseline** después de las pruebas:

```
companies=2 users=5 memberships=3 products=2 categories=2
customers=2 sales=0 subs=0 proofs=0 checkout=0 plans=4 employees=3
```

Usuarios demo (contraseña `Admin123!!`): `superadmin@ventas-saas.local`, `support@ventas-saas.local`, `admin@acme.local`, `manager@acme.local`, `cajero@acme.local`.

---

## 3. Qué falta

### Resuelto en esta sesión (P3, P5–P8)

| # | Punto | Qué se hizo |
|---|-------|-------------|
| P5 | `CreateCheckoutRequestDto` sin aplicar | `POST /payments/checkout/requests` ahora usa el DTO (`@Body() body: CreateCheckoutRequestDto`) ⇒ validación + whitelist. `paymentMethod` se normaliza a mayúsculas con `@Transform`. Se conserva el chequeo anti-spoofing de `companyId`. De paso: eliminadas `GET/POST /payments/checkout/test` y corregido `review()` (pasaba `user.id` inexistente ⇒ ahora `user.sub`) |
| P6 | `TenantGuard` con superadmin sin `companyId` | Ahora lanza **403** "Tenant context is required for this resource." en lugar de `return true` con `tenantId` `undefined` (= "sin filtro" en Prisma). El `tenantId` se fija siempre antes de resolver |
| P7 | Endpoints públicos de comprobantes | `POST /payment-settings/proof/:subscriptionId` y `GET /payment-settings/proof/subscription/:subscriptionId` ya requieren JWT y validan que la suscripción pertenezca a la empresa del usuario (404 al cruzar tenant). Frontend `payment-proof-upload.tsx` (sin uso) ya envía token. `GET /payment-settings` y `/provider/:provider` se **mantienen públicos por diseño** (los usan el checkout y la UI de admin) |
| P8 | Falta `shadowDatabaseUrl` | `prisma.config.ts` agrega `shadowDatabaseUrl` condicionalmente si `SHADOW_DATABASE_URL` existe. `prisma migrate status` sigue **up to date** |
| P3 | No había suite de tests | Suite unitaria con el runner nativo de Node 22 (`node:test`) + ts-node, **sin dependencias nuevas** (jest/supertest no estaban instalados). 23 tests verdes. Script `npm test`. `tsconfig.json` gana opción `ts-node.transpileOnly` |

### Prioridad alta

| # | Pendiente | Detalle |
|---|-----------|---------|
| 1 | **Commitear y pushear** las correcciones de seguridad | 9 archivos modificados + 1 guard nuevo + 7 specs + 2 docs |
| 2 | **Redeploy en Render** | Tras el push; `start.sh` ya corre `migrate deploy` |
| 3 | **Rotar secretos JWT de producción** | Siguen los valores de desarrollo |
| 4 | **Build de frontend sin verificar** | `npm run build` local superó los 10 min; confirmar en CI/Vercel |

### Prioridad media

| # | Pendiente | Detalle |
|---|-----------|---------|
| 5 | Rutas de prueba estáticas | `GET /debug/routes` no toca BD ni filtra datos; eliminarla es higiene, no urgencia (las de `/payments/checkout/test` ya se eliminaron) |

### Bloqueos / limitaciones del entorno

| # | Bloqueo | Detalle |
|---|---------|---------|
| 11 | `prisma migrate diff --from-migrations` | Falla: requiere `shadowDatabaseUrl` en `prisma.config.ts` |
| 12 | `psql` no instalado | Todo se hace vía Prisma raw o scripts temporales en `backend/prisma/_tmp-*.ts` (borrar siempre después) |
| 13 | Prisma 7 | `--to-schema-datamodel` fue eliminado; usar `--to-schema` / `--from-config-datasource`. `count`/`deleteMany` exigen `{ where: ... }`. Errores solo se importan de `@prisma/client/runtime/client` |

---

## 4. Verificación empírica realizada

| Prueba | Esperado | Resultado |
|--------|----------|-----------|
| `POST /products` con `categoryId` de otra empresa | 404 | **404** ✅ |
| `POST /products` con `categoryId` inexistente | 404 | **404** ✅ |
| `POST /products` con `categoryId` propia | 201 | **201** ✅ |
| `POST /sales` con `customerId` de otra empresa | 404 | **404** ✅ |
| `POST /sales` con `employeeId` inválido | 404 | **404** ✅ |
| `POST /sales` venta legítima | 201 | **201** ✅ |
| `GET /invoices/generate/:id` con venta ajena | 404 | **404** ✅ |
| `GET /invoices/generate/:id` con venta propia | 200 | **200** ✅ |
| `POST /payments/checkout/requests` invitado (sin companyId) | 201 | **201** ✅ |
| `POST /payments/checkout/requests` con companyId sin sesión | 401 | **401** ✅ |
| `POST /payments/checkout/requests` autenticado | 201 | **201** ✅ |
| `POST .../proof` con companyId sin sesión | 401 | **401** ✅ |
| `POST .../proof` invitado | 201 | **201** ✅ |
| `GET /api/sales/test` (antes público) | ya no público | **401** ✅ |
| `GET /api/health/live` | 200 | **200** ✅ |
| `prisma migrate status` | up to date | **up to date** ✅ |

### Verificación unitaria (`npm test` — 23 tests, todos verdes)

| Suite | Cubre |
|-------|-------|
| `TenantGuard` | Superadmin sin `companyId` → 403 (ya no "ve todo"); con `companyId` scopes; miembros de empresa suspendida bloqueados |
| `OptionalJwtAuthGuard` | Session ✓ → usuario; sin sesión → `null` (no lanza) |
| `ProductsService.ensureCategory` | `where` incluye `companyId`; categoría ajena → NotFound |
| `InvoicesService.generateInvoiceHtml` | `where` venta incluye `companyId`; venta ajena → 404; propia → HTML |
| `PaymentSettingsService` | `getProofById`/`uploadPaymentProof` con suscripción ajena → 404; propias OK y sin exponer `subscription` |
| `CheckoutRequestsController` | Spoof de `companyId` sin sesión → 401; inyección del `companyId` de sesión; proof scoped; `review` usa `user.sub` |
| `SalesService.createSale` | Regresión TDZ (venta 201 sin `Cannot access 'sale'`); producto de otra empresa → "not found" |

> **Nota importante:** durante las pruebas un proceso con `dist` desactualizado respondió en el puerto 4000 y simuló fallos. Si un resultado no coincide con el código fuente, **matar todos los `node dist\main.js` y reconstruir** antes de concluir.

---

## 5. Cómo desplegar

```bash
git add -A
git commit -m "Seguridad multi-tenant: scoping de tenant, checkout por JWT, IDOR de comprobantes"
git push
# Render hace redeploy automático; start.sh corre: prisma migrate deploy (+ seed si SEED_ON_DEPLOY=true)
```

Rotar después en Render: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (y regenerar sesiones).
