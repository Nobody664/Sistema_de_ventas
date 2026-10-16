# Módulo: Audit (consulta de auditoría)

## Propósito
Expone la consulta paginada de los registros de auditoría de la empresa (`audit_logs`) y de la
plataforma global. Se apoya en `AuditService` (escritura/lectura de logs) y `AuditContextService`
(contexto por request) del módulo común `@Global() AuditCommonModule`.

## Archivos clave
- `backend/src/modules/audit/audit.controller.ts` — controller `audit` (`/api/audit/global`, `/api/audit/tenant`).
- `backend/src/modules/audit/audit.module.ts` — importa `PrismaModule` y `AuditCommonModule`; declara `AuditController`.
- `backend/src/common/services/audit.service.ts` — `AuditService` (`log`, `findMany`).
- `backend/src/common/services/audit-context.service.ts` — `AuditContextService` (AsyncLocalStorage).
- `backend/src/common/services/audit.module.ts` — `AuditCommonModule` (`@Global()`), exporta ambos servicios.

Contexto complementario: [`../arquitectura.md`](../arquitectura.md) (sección Auditoría),
[`../modelo-de-datos.md`](../modelo-de-datos.md) (`AuditLog`, `PlatformAuditLog`).

## Endpoints

### GET /api/audit/global
- **Descripción**: lista registros de `audit_logs` sin filtrar por empresa (vista global de plataforma), ordenados por `createdAt` descendente y paginados.
- **Auth**: JWT (guard global `JwtAuthGuard`) + `@Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')` (aplicado por el `RolesGuard` global; `SUPER_ADMIN` siempre pasa).
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)` a nivel de método (redundante con los guards globales).
- **Path params**: ninguno.
- **Query (interfaz `AuditQueryDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|-----------|-------------|
  | `userId` | string | no | ninguna | Filtra por usuario. |
  | `entity` | string | no | ninguna | Filtra por entidad. |
  | `action` | `AuditAction` | no | ninguna | Filtra por acción (`CREATE`/`UPDATE`/`DELETE`/`LOGIN`/`LOGOUT`/`EXPORT`). |
  | `from` | string | no | ninguna | Fecha ISO convertida con `new Date(query.from)`. |
  | `to` | string | no | ninguna | Fecha ISO convertida con `new Date(query.to)`. |
  | `page` | string | no | ninguna | Convertido con `Number(...)`. |
  | `limit` | string | no | ninguna | Convertido con `Number(...)`. |

  Nota: `AuditQueryDto` es una **interfaz TypeScript**, no una clase con decoradores `class-validator`, por lo que el `ValidationPipe` global no aplica `whitelist`/`forbidNonWhitelisted` ni transforma tipos; el parseo manual es responsabilidad del controller.
- **Body**: no aplica.
- **Respuesta**: `{ items, total, page, limit, totalPages }`. Cada `item` es un `AuditLog` con `user` incluido (`{ id, email, fullName }`). `page` por defecto 1; `limit` por defecto 50 y tope 200.
- **Efectos secundarios**: ninguno (solo lectura).
- **Errores**: ninguno explícito en el código (los del filtro global aplican).

### GET /api/audit/tenant
- **Descripción**: lista registros de `audit_logs` de la empresa del usuario (multi-tenant), ordenados por `createdAt` descendente y paginados.
- **Auth**: JWT + `TenantGuard` (exige `companyId` en el token; bloquea `SUSPENDED`/`INACTIVE`/`PAST_DUE`).
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)` a nivel de método.
- **Path params**: ninguno.
- **Query (interfaz `AuditQueryDto`)**: mismos campos que `GET /api/audit/global` (sin `companyId`, que se toma de `request.tenantId`).
- **Body**: no aplica.
- **Respuesta**: idéntica a `GET /api/audit/global`, pero filtrada por `companyId = request.tenantId`.
- **Efectos secundarios**: ninguno (solo lectura).
- **Errores**:
  - `403` si falta el contexto de tenant o la empresa está `SUSPENDED`/`INACTIVE`/`PAST_DUE` (mensajes de `TenantGuard`).
- **Nota**: `TenantGuard` fija `request.tenantId` desde `user.companyId`; los administradores globales (`SUPER_ADMIN`/`SUPPORT_ADMIN`) requieren igualmente `companyId` en el token o reciben `403`.

## Funciones del servicio (`AuditService`)

### `log(input, client?)`
- **Qué hace**: crea una fila en `audit_logs`. Si `input.changes` es no nulo, lo normaliza con `JSON.parse(JSON.stringify(...))` a `Prisma.InputJsonValue`. Completa `userId`, `ipAddress` y `userAgent` con el `AuditContextService` cuando no vienen en `input`. Permite recibir un `client` (transacción Prisma: `Prisma.TransactionClient`) para participar de una transacción.
- **Escribe en**: `audit_logs`.
- **Devuelve**: `Promise<void>`.
- **Lanza**: si se pasa `client` (transacción), propaga el error; si no, captura el error y lo registra con `logger.error` (no propaga).

### `findMany(options)`
- **Qué hace**: arma `where` con `companyId`, `userId`, `entity`, `action` y rango de fechas (`createdAt.gte/lte`); normaliza `page` (`>=1`) y `limit` (`1..200`, por defecto 50); ejecuta en una `$transaction` un `findMany` ordenado por `createdAt desc` con `skip/take` e incluye `user` (`{ id, email, fullName }`) y un `count`.
- **Escribe en**: no escribe.
- **Devuelve**: `{ items, total, page, limit, totalPages }`.
- **Lanza**: nada explícito (errores Prisma se propagan y los normaliza `AllExceptionsFilter`).

## `AuditContextService`

### `run(context, callback)`
- **Qué hace**: ejecuta `callback` dentro de un `AsyncLocalStorage` con `{ userId, ipAddress, userAgent }`.
- **Devuelve**: el resultado de `callback`.

### `get()`
- **Qué hace**: devuelve el contexto almacenado en el request actual, o `undefined`.
- **Devuelve**: `AuditContext | undefined`.

## Módulo común (`AuditCommonModule`)
- `@Global()`; importa `PrismaModule`; provee y exporta `AuditService` y `AuditContextService`.
- El `AuditContextInterceptor` global (en `app.module.ts`) es quien invoca `AuditContextService.run(...)` por cada request HTTP, tomando `userId` de `request.user.sub ?? request.user.userId`, la IP real (`x-forwarded-for` o `request.ip`/`socket.remoteAddress`) y el `user-agent`.

## Observaciones
- Los `AuditLog` con `companyId` viven en `audit_logs`; el área de plataforma usa `platform_audit_logs` (ver `backend/platform.md`), que **no** se consulta desde este controller.
- El controller no ofrece endpoints de escritura: la auditoría se escribe desde los servicios de dominio llamando a `AuditService.log(...)`.
