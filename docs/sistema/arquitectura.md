# Arquitectura

## Stack

- **Backend**: NestJS (TypeScript, strict) + Prisma ORM + PostgreSQL + BullMQ (colas, opcional
  con `REDIS_URL`) + ioredis (caché) + Passport JWT + `class-validator` / `class-transformer`.
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS + Zustand (estado) +
  `apiFetch` propio como cliente HTTP.
- **Infra**: Backend en Render, Frontend en Vercel, PostgreSQL gestionado (Supabase/Render).

## Estructura del backend (`backend/src/`)

```
src/
├── main.ts                 # Bootstrap: helmet, cookie-parser, CORS, ValidationPipe, Swagger, listen
├── app.module.ts           # Módulo raíz: importa todos los módulos y registra guards/filtros globales
├── config/env.ts           # Validación de variables de entorno con zod (envSchema)
├── cache/                  # CacheService (ioredis) + CacheModule
├── database/prisma/        # PrismaService (conexión, onModuleInit/onModuleDestroy)
├── common/
│   ├── constants/permissions.constant.ts   # Enum Permission + ROLE_PERMISSIONS
│   ├── decorators/         # @Public @Roles @Permissions @CurrentUser
│   ├── filters/            # AllExceptionsFilter (mapea errores Prisma y HTTP)
│   ├── guards/             # JwtAuthGuard, RolesGuard, PermissionsGuard, TenantGuard,
│   │                       #   PlatformGuard, CsrfGuard, SubscriptionLimitGuard
│   ├── interceptors/       # AuditContextInterceptor (userId/IP/userAgent por request)
│   └── services/           # AuditService, AuditContextService, AuditCommonModule
└── modules/                # Un módulo por dominio (ver backend/README.md)
```

## Estructura del frontend (`frontend/`)

```
app/
├── (dashboard)/   # Área de la empresa (productos, ventas, inventario, etc.)
├── (platform)/    # Área de super-admin (empresas, planes, suscriptores, plantillas)
├── (marketing)/   # Público (pricing)
├── sign-in, sign-up, forgot-password, reset-password, checkout, ...
└── api/           # Route handlers de Next (proxy de auth/register)
components/        # Componentes por dominio (products, sales, inventory, ...)
lib/               # api (cliente HTTP), validations (zod), plan-capabilities, shared
store/, stores/    # Estado global (Zustand)
```

## Arranque de la aplicación (`main.ts`)

1. `NestFactory.create(AppModule)`.
2. `trust proxy = 1` (para IP real detrás de Render/Nginx).
3. **helmet** con Content-Security-Policy restrictiva.
4. `json({ limit: '2mb' })`, `urlencoded`, `cookieParser()`.
5. **ValidationPipe** global: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
   → Los campos no declarados en el DTO son rechazados.
6. **CORS**: orígenes desde `CORS_ORIGINS` + el dominio de Vercel; `credentials: true`.
7. Prefijo global `API_PREFIX` (por defecto `api`).
8. **Swagger** solo fuera de producción, en `/{apiPrefix}/docs`.
9. `listen(PORT, '0.0.0.0')` (por defecto 10000 en Render).

## Cadena de guards globales (orden de ejecución)

Registrados en `app.module.ts`:

1. `CsrfGuard` → rechaza mutaciones sin `Content-Type: application/json`.
2. `ThrottlerGuard` → rate limiting (límite global 60 req/min; los controllers lo sobreescriben).
3. `JwtAuthGuard` → valida JWT (cookie `access_token` o `Authorization: Bearer`). Salta si `@Public()`.
4. `RolesGuard` → valida `@Roles(...)`. `SUPER_ADMIN` siempre pasa.
5. `PlanCapabilitiesGuard` → valida `@RequirePlan/@RequireModule/@RequireFeature`. Admins globales pasan.

Otros guards **no globales**, aplicados por endpoint con `@UseGuards(...)`:

- `TenantGuard` → exige `companyId` en el token y bloquea cuentas `SUSPENDED/INACTIVE/PAST_DUE`.
- `PermissionsGuard` → valida `@Permissions(...)` contra `ROLE_PERMISSIONS`.
- `PlatformGuard` → exige rol `SUPER_ADMIN` o `SUPPORT_ADMIN`.
- `SubscriptionLimitGuard` + `@LimitResource('products'|'users'|...)` → valida límites del plan.

Además se registra `AllExceptionsFilter` (global) y el `AuditContextInterceptor` (global).

## Autenticación y sesión

- **Login/registro** (`auth.controller.ts`): emiten `accessToken` (JWT, TTL `JWT_ACCESS_TTL`) y un
  **refresh token opaco** (64 bytes, se guarda hasheado con SHA-256 en `refresh_tokens`). Ambos se
  setean como cookies `httpOnly` (`access_token`, `refresh_token`). `secure` + `sameSite=none` en prod.
- **JWT** (`jwt.strategy.ts`): extrae el token de la cookie `access_token` o del header Bearer.
  El payload incluye `sub`, `email`, `companyId`, `roles`, `companyStatus`. `validate()` refresca
  `companyStatus` desde `companies` (cacheado 30s).
- **Refresh** (`auth.service.refresh`): rota el token (family). Detecta reuso de un token revocado y
  revoca toda la familia (protección contra robo de tokens). TTL configurable `JWT_REFRESH_TTL`.
- **Reset de contraseña**: token opaco tipo `RESET` (TTL 15 min) enviado por email; al usarlo revoca
  todas las sesiones activas.
- **Multi-tenant**: el `companyId` vive en el JWT. Cada servicio filtra por `companyId`; el
  `TenantGuard` garantiza el contexto. Un usuario puede tener varias `Membership` (empresas).

## Manejo de errores (`AllExceptionsFilter`)

Normaliza toda excepción a `{ statusCode, message, error?, code?, path, timestamp }`.

Mapea errores de Prisma a HTTP: `P2002→409`, `P2003→409`, `P2025→404`, `P2000/P2011/P2014→400`,
`P2034→409`. `PrismaClientValidationError→400`, `PrismaClientInitializationError→503`.
En producción los `Error` genéricos devuelven "Error interno del servidor".

## Caché

`CacheService` (ioredis) con TTL. Usado para: capacidades de plan (`plan:caps:<companyId>`, 60s)
y estado de empresa (`company:status:<companyId>`, 30s). Si Redis no está disponible, hay fallback.

## Auditoría

`AuditContextInterceptor` envuelve cada request en un AsyncLocalStorage con `{ userId, ipAddress,
userAgent }`. `AuditService.log()` escribe en `audit_logs` reutilizando ese contexto. Los servicios
llaman a `auditService.log(...)` en las operaciones relevantes. El área de plataforma usa
`platform_audit_logs` (ver `backend/platform.md`).

## Variables de entorno (resumen, `config/env.ts`)

`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL` (def. `60m`),
`JWT_REFRESH_TTL` (def. `30d`), `REDIS_URL` (opcional), `SMTP_*`, `FRONTEND_URL`, `CORS_ORIGINS`,
`API_PREFIX` (def. `api`), `PORT`, `NODE_ENV`, `DB_SSL*`, credenciales de Stripe/MercadoPago/PayPal,
`S3_*`. La validación falla el arranque si falta algo obligatorio (ej. `DATABASE_URL`).
