# Registro de errores

Bitácora de errores relevantes del proyecto con causa y corrección.

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