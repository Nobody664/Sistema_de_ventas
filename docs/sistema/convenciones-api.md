# Convenciones de la API

## Ruta y prefijo

- Prefijo global: `/{API_PREFIX}` (por defecto `api`). Ej: `GET /api/products`.
- Reescritura en el frontend: `frontend/next.config.ts` redirige `/api/*` al backend.
- Swagger (solo no-producción): `/api/docs`.

## Autenticación

- JWT en cookie `access_token` (httpOnly) o header `Authorization: Bearer <token>`.
- Refresh en cookie `refresh_token` (httpOnly, opaco, rota en cada uso).
- Endpoints públicos marcados con `@Public()`.

## Cabeceras y CSRF

- Las mutaciones (**POST/PUT/PATCH/DELETE**) deben enviar `Content-Type: application/json`
  o el `CsrfGuard` responde **403**:
  > `Operación rechazada (protección CSRF): se requiere Content-Type: application/json`
- CORS con credenciales; orígenes permitidos desde `CORS_ORIGINS` + dominio de Vercel.

## Validación

- `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`:
  campos no declarados en el DTO → **400**. Los DTOs usan `class-validator`.
- `transform: true` → los tipos se convierten según los decoradores del DTO.

## Formato de errores

`AllExceptionsFilter` normaliza todo a:

```json
{
  "statusCode": 409,
  "message": "Ya existe un registro con ese valor en sku.",
  "error": "Conflict",
  "code": "P2002",
  "path": "/api/products",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

- `message` puede ser `string` o `string[]` (errores de validación).
- Errores de gating y límites usan un objeto con campos propios, p. ej.
  `{ error: 'MODULE_NOT_ENABLED', modules, currentPlan, upgradeUrl }`.
- Errores Prisma mapeados: ver [`arquitectura.md`](./arquitectura.md#manejo-de-errores-allexceptionsfilter).

## Paginación y filtros

Patrón predominante en listados: query `page` (def. 1) y `limit` (def. 20/50, tope 100/200),
respuesta:

```json
{ "items": [], "total": 0, "page": 1, "limit": 50, "totalPages": 0 }
```

Algunos endpoints devuelven directamente un array (los de catálogos pequeños).
`GET /api/sales` también devuelve un array pese a aceptar `page`/`limit`, por compatibilidad con el
frontend; `GET /api/companies` usa la clave `data` en lugar de `items`.

## Throttling (rate limiting)

- Límite global: **60 req / 60s** (`ThrottlerGuard`).
- Se sobreescribe por endpoint con `@Throttle({ default: { limit, ttl } })`, p. ej.:
  - `POST /auth/login` → 5/min
  - `POST /auth/register` → 3/min
  - `POST /auth/forgot-password`, `/auth/reset-password` → 3 / 5min

## Multi-tenant

- Todo servicio filtra por `companyId` (del JWT). Nunca se confía en un `companyId` del body.
- `TenantGuard` (por endpoint) exige `companyId` y bloquea empresas
  `SUSPENDED` / `INACTIVE` / `PAST_DUE` con mensajes específicos.

## Respuestas de sesión (auth)

`login`/`register`/`refresh` devuelven `{ user, expiresIn }` y además setean las cookies.
El `user` incluye `id, email, fullName, companyId, roles, companyStatus, planCode,
subscriptionStatus, trialEndsAt`.

## Auditoría

Operaciones auditables llaman a `AuditService.log({ companyId, action, entity, entityId, changes })`.
El `userId`, `ipAddress` y `userAgent` se toman automáticamente del `AuditContextInterceptor`.
