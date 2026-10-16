# Módulo: Auth

## Propósito
Gestiona el registro de empresas y su usuario propietario, el inicio/cierre de sesión,
la emisión y rotación de tokens (JWT de acceso + refresh token opaco), la recuperación y
cambio de contraseña, y la lectura/actualización del perfil del usuario autenticado.

## Archivos clave
- `backend/src/modules/auth/auth.controller.ts` — expone los endpoints de sesión y setea/limpia las cookies.
- `backend/src/modules/auth/auth.service.ts` — lógica de negocio: sesiones, tokens, contraseñas.
- `backend/src/modules/auth/auth.module.ts` — importa `UsersModule`, `NotificationsModule`, `EmailModule`, `PrismaModule`; registra `JwtModule` con `JWT_ACCESS_SECRET`. Exporta `AuthService`.
- `backend/src/modules/auth/jwt.strategy.ts` — extrae el JWT de la cookie `access_token` o del header `Authorization: Bearer`; refresca `companyStatus` desde `companies` (cache 30s).
- `backend/src/modules/auth/dto/auth.dto.ts` — DTOs de validación (`RegisterDto`, `LoginDto`, `RefreshTokenDto`, `ForgotPasswordDto`, `ResetPasswordDto`, `ChangePasswordDto`, `UpdateProfileDto`, `AuthSessionDto`).

## Endpoints

Notas de guards:
- Globales (registrados en `app.module.ts`, se aplican a todos los endpoints): `CsrfGuard`, `ThrottlerGuard` (60 req/60s por defecto), `JwtAuthGuard`, `RolesGuard`, `PlanCapabilitiesGuard`.
- `AuthController` está declarado con `@Controller('auth')` sin `@UseGuards` a nivel de clase. Los endpoints `GET me`, `PATCH me` y `POST change-password` repiten `@UseGuards(JwtAuthGuard)` por endpoint (redundante con el guard global).
- Los endpoints marcados con `@Public()` hacen que `JwtAuthGuard` y `TenantGuard` se salten.
- Ningún endpoint de este módulo usa `@Roles`, `@Permissions`, `@RequireModule`, `@RequireFeature`, `@RequirePlan` ni `@LimitResource`.

### POST /api/auth/register
- **Descripción**: Registra una empresa nueva en estado `TRIAL` y su usuario propietario, crea la suscripción y abre una sesión.
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Throttling**: `@Throttle({ default: { limit: 3, ttl: 60_000 } })` → 3/min.
- **Body (DTO `RegisterDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `fullName` | string | Sí | `@IsString`, `@MinLength(2)` | Nombre completo del propietario. |
| `companyName` | string | Sí | `@IsString`, `@MinLength(2)` | Nombre de la empresa (base del `slug`). |
| `email` | string | Sí | `@IsEmail` | Correo del propietario (único). |
| `password` | string | Sí | `@IsString`, `@MinLength(8)` | Contraseña sin hashear. |
| `phone` | string | No | `@IsOptional`, `@IsString` | Teléfono de la empresa. |
| `planCode` | string | No | `@IsOptional`, `@IsString` | Código de plan; por defecto `'FREE'`. Debe existir en `plans`. |
| `paymentMethod` | string | No | `@IsOptional`, `@IsString` | Declarado en el DTO pero no utilizado por el servicio. |

- **Respuesta**: `{ user, expiresIn }` y setea cookies. `user` = `{ id, email, fullName, companyId, roles, companyStatus, planCode, subscriptionStatus, trialEndsAt }`. En registro `roles` es `['COMPANY_ADMIN']`.
- **Efectos secundarios**:
  - Escribe en `companies` (status `TRIAL`, `trialEndsAt` = ahora + 7 días, `slug` generado).
  - Lee `plans` (`code = planCode`).
  - Escribe en `subscriptions` (plan del `planCode`, `status` `TRIALING`, `billingCycle` del plan, `endDate` = trial).
  - Escribe en `users` y `memberships` (rol `COMPANY_ADMIN`) vía `UsersService.createOwner`.
  - Escribe en `refresh_tokens` (sesión).
  - Setea cookies `access_token` (maxAge 15 min) y `refresh_token` (maxAge 7 días), `httpOnly`; `secure`+`sameSite=none` en producción.
  - No envía email, no crea notificaciones ni auditoría.
- **Errores**: `409` si el email ya está registrado (`El correo electrónico ya está registrado.`); `400` si el plan no existe (`Plan con código <code> no encontrado.`); `403` por CSRF (mutación sin `Content-Type: application/json`); `429` por throttling; `400` por validación.

### POST /api/auth/login
- **Descripción**: Autentica usuario por email y contraseña y abre sesión.
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Throttling**: `@Throttle({ default: { limit: 5, ttl: 60_000 } })` → 5/min. `@HttpCode(200)`.
- **Body (DTO `LoginDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `email` | string | Sí | `@IsEmail` | Correo del usuario. |
| `password` | string | Sí | `@IsString`, `@MinLength(8)` | Contraseña sin hashear. |

- **Respuesta**: `{ user, expiresIn }`; setea cookies de sesión. `user` = `{ id, email, fullName, companyId, roles, companyStatus, planCode, subscriptionStatus, trialEndsAt }`. Los `roles` combinan `globalRole` + rol de la primera `Membership` activa (orden por `createdAt asc`).
- **Efectos secundarios**: escribe en `refresh_tokens` (sesión); setea cookies `access_token` y `refresh_token`. No audita ni envía email.
- **Errores**: `401` credenciales inválidas (`Invalid credentials.`); `401` si la empresa está `SUSPENDED` (`Tu cuenta ha sido suspendida. Contacta al administrador.`); `403` CSRF; `429` throttling; `400` validación.

### POST /api/auth/refresh
- **Descripción**: Rota el refresh token y emite un nuevo access token.
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Throttling**: `@Throttle({ default: { limit: 20, ttl: 60_000 } })` → 20/min. `@HttpCode(200)`.
- **Body (DTO `RefreshTokenDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `refreshToken` | string | No | `@IsOptional`, `@IsString` | Si no se envía, se usa la cookie `refresh_token`. |

- **Respuesta**: `{ expiresIn }` (no devuelve `user`); setea nuevas cookies.
- **Efectos secundarios**: transacción que crea un nuevo `refresh_tokens` (misma `familyId`) y revoca el anterior (`revokedAt`, `replacedBy`); setea cookies.
- **Errores**: `401` sin token (`Refresh token is required.`); `401` token inválido/no `SESSION`/expirado (`Invalid refresh token.`); `401` usuario no encontrado (`User not found.`). Si detecta reuso de un token ya revocado, revoca toda la familia y responde `401`. `403` CSRF; `429` throttling.

### POST /api/auth/forgot-password
- **Descripción**: Genera un token opaco de tipo `RESET` y envía por email el enlace de restablecimiento.
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Throttling**: `@Throttle({ default: { limit: 3, ttl: 5 * 60_000 } })` → 3/5min. `@HttpCode(200)`.
- **Body (DTO `ForgotPasswordDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `email` | string | Sí | `@IsEmail` | Correo de la cuenta a recuperar. |

- **Respuesta**: siempre `{ status: 'queued', message: 'If an account exists with that email, a password reset link will be sent.' }`. En `NODE_ENV=development` agrega `devToken`.
- **Efectos secundarios**: si el usuario existe, escribe en `refresh_tokens` (tipo `RESET`, `familyId` con prefijo `reset:`, TTL 15 min) y envía email `PASSWORD_RESET` (vía `EmailService.sendPasswordReset`). Los fallos de envío de email se loguean pero no alteran la respuesta.
- **Errores**: no revela existencia de la cuenta (`200` en todos los casos). `403` CSRF; `429` throttling; `400` validación.

### POST /api/auth/test-public
- **Descripción**: Endpoint de prueba que devuelve un mensaje fijo.
- **Auth**: JWT. A pesar del nombre, en el código **no está marcado con `@Public()`**, por lo que aplica el `JwtAuthGuard` global y requiere autenticación.
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Throttling**: sin override (límite global 60/min). `@HttpCode(200)`.
- **Body**: ninguno.
- **Respuesta**: `{ message: 'Test public works!' }`.
- **Efectos secundarios**: ninguno.
- **Errores**: `401` si no hay token válido; `403` CSRF.

### GET /api/auth/me
- **Descripción**: Devuelve el usuario actual extraído del JWT.
- **Auth**: JWT (global + `@UseGuards(JwtAuthGuard)` explícito).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: ninguno.
- **Respuesta**: el objeto `request.user` (payload del JWT fusionado con `companyStatus` en `JwtStrategy.validate`): `{ sub, email, fullName, companyId, roles, companyStatus, trialEndsAt }`.
- **Efectos secundarios**: ninguno.
- **Errores**: `401` sin token (`No autorizado`).

### PATCH /api/auth/me
- **Descripción**: Actualiza el `fullName` del usuario y reemite el access token.
- **Auth**: JWT (global + `@UseGuards(JwtAuthGuard)` explícito).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Throttling**: sin override (global 60/min). `@HttpCode(200)`.
- **Body (DTO `UpdateProfileDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `fullName` | string | Sí | `@IsString`, `@MinLength(2)`, `@MaxLength(100)` | Nuevo nombre completo. |

- **Respuesta**: `{ user }` con `{ id, email, fullName, companyId, roles, companyStatus, planCode, subscriptionStatus, trialEndsAt }`; setea la cookie `access_token`.
- **Efectos secundarios**: actualiza `users.fullName`; lee `memberships` y `subscriptions`/`plans`; firma un nuevo access token y setea la cookie `access_token`.
- **Errores**: `401` si el usuario no existe (`User not found.`); `403` CSRF; `400` validación.

### POST /api/auth/change-password
- **Descripción**: Cambia la contraseña del usuario autenticado verificando la contraseña actual.
- **Auth**: JWT (global + `@UseGuards(JwtAuthGuard)` explícito).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Throttling**: sin override (global 60/min). `@HttpCode(200)`.
- **Body (DTO `ChangePasswordDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `oldPassword` | string | Sí | `@IsString` | Contraseña actual. |
| `newPassword` | string | Sí | `@IsString`, `@MinLength(8)` | Nueva contraseña. |

- **Respuesta**: `{ message: 'Password changed successfully.' }`.
- **Efectos secundarios**: actualiza `users.passwordHash` y revoca todos los `refresh_tokens` de sesión activos del usuario (`revokedAt`). No reemite sesión en esta petición.
- **Errores**: `401` usuario no encontrado o contraseña actual incorrecta (`Current password is incorrect.`); `403` CSRF; `400` validación.

### POST /api/auth/reset-password
- **Descripción**: Restablece la contraseña usando un token `RESET`.
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Throttling**: `@Throttle({ default: { limit: 3, ttl: 5 * 60_000 } })` → 3/5min. `@HttpCode(200)`.
- **Body (DTO `ResetPasswordDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `token` | string | Sí | `@IsString` | Token opaco recibido por email. |
| `password` | string | Sí | `@IsString`, `@MinLength(8)` | Nueva contraseña. |

- **Respuesta**: `{ message: 'Password updated successfully.' }`.
- **Efectos secundarios**: transacción que actualiza `users.passwordHash`, revoca el token `RESET` usado y revoca todas las sesiones (`refresh_tokens` tipo `SESSION` activos) del usuario.
- **Errores**: `400` token inválido/expirado/ya usado (`Invalid or expired password reset token.`); `403` CSRF; `429` throttling; `400` validación.

### POST /api/auth/logout
- **Descripción**: Cierra sesión revocando el refresh token y limpiando cookies.
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Throttling**: `@Throttle({ default: { limit: 10, ttl: 60_000 } })` → 10/min. `@HttpCode(200)`.
- **Body**: ninguno (usa la cookie `refresh_token`).
- **Respuesta**: `{ message: 'Logged out successfully' }`; limpia cookies `access_token` y `refresh_token` (`maxAge: 0`).
- **Efectos secundarios**: si se resuelve el `refreshToken` de la cookie, revoca toda su familia en `refresh_tokens`. El controller **no pasa `userId`** al servicio, por lo que la rama por `userId` de `logout()` no se usa desde este endpoint.
- **Errores**: `403` CSRF.

## Funciones del servicio (`AuthService`)

### `register(input: RegisterDto)`
- **Qué hace**: Verifica email único, crea empresa `TRIAL` con `slug` generado y `trialEndsAt` (+7 días), resuelve el plan (`planCode` o `'FREE'`), crea la suscripción `TRIALING`, hashea la contraseña con argon2 y crea el usuario propietario (rol de membresía `COMPANY_ADMIN`), y abre sesión.
- **Escribe en**: `companies`, `subscriptions`, `users`, `memberships`, `refresh_tokens`.
- **Devuelve**: `{ accessToken, refreshToken, user, expiresIn }`.
- **Lanza**: `ConflictException` (409) si el email existe; `BadRequestException` (400) si el plan no existe.

### `login(input: LoginDto)`
- **Qué hace**: Busca el usuario por email, verifica la contraseña con argon2, obtiene la primera `Membership` activa, bloquea si la empresa está `SUSPENDED`, resuelve plan/suscripción y abre sesión.
- **Escribe en**: `refresh_tokens`.
- **Devuelve**: `{ accessToken, refreshToken, user, expiresIn }`.
- **Lanza**: `UnauthorizedException` (401) por credenciales inválidas o cuenta suspendida.

### `refresh(rawToken?, ipAddress?, userAgent?)`
- **Qué hace**: Hashea el token recibido, lo busca en `refresh_tokens`. Si está revocado revoca toda la familia (`familyId`) y falla (detección de reuso). Si expiró lo revoca y falla. Reconstruye membership/plan y, en una transacción, crea un nuevo token de sesión con la misma `familyId` y marca el anterior como revocado (`replacedBy`).
- **Escribe en**: `refresh_tokens` (create + update, dentro de `$transaction`).
- **Devuelve**: `{ accessToken, refreshToken, expiresIn }`.
- **Lanza**: `UnauthorizedException` (401) sin token, token inválido, expirado o usuario no encontrado.

### `logout(rawToken?, userId?)`
- **Qué hace**: Si recibe un `rawToken` válido de tipo `SESSION`, revoca toda su familia. Si recibe `userId` (no usado por el controller), revoca todas las sesiones activas del usuario.
- **Escribe en**: `refresh_tokens` (updateMany `revokedAt`).
- **Devuelve**: `void`.
- **Lanza**: ninguna excepción.

### `forgotPassword(email: string)`
- **Qué hace**: Busca el usuario por email. Si no existe, devuelve una respuesta genérica. Si existe, genera token opaco, lo guarda como `RESET` (TTL 15 min) y envía el email con el enlace `${FRONTEND_URL}/reset-password?token=<token>`.
- **Escribe en**: `refresh_tokens` (tipo `RESET`).
- **Devuelve**: `{ status: 'queued', message, devToken? }` (el `devToken` solo en `NODE_ENV=development`).
- **Lanza**: ninguna (los errores de email se loguean).

### `resetPassword(token: string, password: string)`
- **Qué hace**: Valida el token `RESET` (existe, no revocado, no expirado), hashea la nueva contraseña y, en transacción, actualiza el usuario, revoca el token `RESET` y revoca todas las sesiones activas del usuario.
- **Escribe en**: `users`, `refresh_tokens`.
- **Devuelve**: `{ message: 'Password updated successfully.' }`.
- **Lanza**: `BadRequestException` (400) si el token es inválido o expirado.

### `changePassword(userId: string, oldPassword: string, newPassword: string)`
- **Qué hace**: Verifica la contraseña actual y actualiza el hash; revoca todas las sesiones activas del usuario.
- **Escribe en**: `users`, `refresh_tokens`.
- **Devuelve**: `{ message: 'Password changed successfully.' }`.
- **Lanza**: `UnauthorizedException` (401) si el usuario no existe o la contraseña actual es incorrecta.

### `updateProfile(userId: string, fullName: string)`
- **Qué hace**: Actualiza `fullName`, resuelve membership/plan y firma un nuevo access token.
- **Escribe en**: `users`.
- **Devuelve**: `{ accessToken, user }` (el `user` incluye `companyStatus`, `planCode`, `subscriptionStatus`, `trialEndsAt`).
- **Lanza**: `UnauthorizedException` (401) si el usuario no existe.

Métodos privados con lógica relevante (no expuestos): `hashToken` (SHA-256), `generateOpaqueToken` (64 bytes hex), `getRefreshTtlMs` (parsea `JWT_REFRESH_TTL`, fallback 7d), `signAccessToken` (firma JWT con `JWT_ACCESS_SECRET`/`JWT_ACCESS_TTL` y adjunta `companyStatus`/`trialEndsAt`), `createSession` (firma access + crea refresh token de sesión).

## Notas de cookies y tokens
- `setAccessCookie`: cookie `access_token`, `httpOnly`, `path=/`, `maxAge` **15 minutos** fijo; `secure`+`sameSite=none` en producción, `sameSite=lax` en otros entornos.
- `setAuthCookies`: además de `access_token` (15 min), setea `refresh_token` con `maxAge` **7 días** fijo.
- `clearAuthCookies`: setea ambas cookies a `''` con `maxAge: 0`.
- El refresh token es opaco (64 bytes hex) y se persiste como hash SHA-256 en `refresh_tokens.tokenHash`. La familia (`familyId`) permite revocar la cadena completa ante reuso.
- Discrepancias de configuración (no verificadas como intencionales): el `maxAge` de la cookie de acceso es fijo en 15 min aunque `JWT_ACCESS_TTL` por defecto es `60m`; el `maxAge` de la cookie de refresh es fijo en 7 días aunque `JWT_REFRESH_TTL` es configurable (default 7d).
