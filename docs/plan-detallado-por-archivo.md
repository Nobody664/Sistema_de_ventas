# Plan Detallado por Archivo - Correciones y Mejoras

**Fecha:** 03 de Octubre de 2026  
**Objetivo:** Aplicar mejoras de seguridad, integridad multi-tenant, robustez de auth y hardening.  
**Alcance:** Backend + Frontend + Schema + Config

---

## 1. Backend - Schema Prisma (`backend/prisma/schema.prisma`)

### Cambios Requeridos

| Línea(s) aprox. | Cambio | Razón |
|---|---|---|
| **Product.sku (l.321)** | `sku String?` → quitar `@unique`. Añadir `@@unique([companyId, sku])` (l.344-347) | Evitar colisión entre empresas. |
| **Product.barcode (l.333)** | quitar `@unique`. Añadir `@@unique([companyId, barcode])` | Multi-tenant correcto. |
| **Employee.dni (l.406)** | quitar `@unique`. Añadir `@@unique([companyId, dni])` (l.415-418) | Permitir mismo DNI en distintas empresas. |
| **Sale.saleNumber (l.355)** | quitar `@unique`. Añadir `@@unique([companyId, saleNumber])` (l.373-377) | Numeración aislada o controlada por empresa. |
| **Customer (l.278-298)** | Añadir `@@unique([companyId, email])` y/o `@@unique([companyId, documentValue])` si `documentValue` no nulo en regla. Revisar `email String?`. | Evitar duplicados dentro de empresa. |
| **SaleItem.product (l.388-395)** | Cambiar `onDelete: Cascade` (l.389) a `onDelete: Restrict` (o evaluar). | Preservar historial de ventas. |
| **Product/Customer/Employee/Category** | Añadir `deletedAt DateTime? @map("deleted_at")` | Habilitar soft delete sin romper integridad histórica. |

### Nuevo Modelo - Refresh Tokens

Añadir al final (después de `PaymentProof` o grupo Auth):

```prisma
model RefreshToken {
  id         String    @id @default(cuid())
  userId     String    @map("user_id")
  companyId  String?   @map("company_id")
  tokenHash  String    @unique @map("token_hash")
  familyId   String    @map("family_id")
  ipAddress  String?   @map("ip_address")
  userAgent  String?   @map("user_agent")
  expiresAt  DateTime  @map("expires_at")
  revokedAt  DateTime? @map("revoked_at")
  replacedBy String?   @map("replaced_by")
  createdAt  DateTime  @default(now()) @map("created_at")

  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  company Company? @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([companyId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
```

**Notas:** Añadir `refreshTokens RefreshToken[]` a `User` y opcional a `Company`.

### Pasos

1. Editar `schema.prisma` con cambios.
2. `npx prisma format` (si disponible).
3. `npx prisma migrate dev --name multi_tenant_uniques_and_refresh_tokens` (revisar datos existentes antes).
4. `npx prisma generate`.

---

## 2. Backend - Configuración (`backend/src/config/env.ts`)

### Cambios

Añadir variables para CORS y SSL DB:

```typescript
// Añadir después de SMTP_* o en grupo DB
CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
DB_SSL: z.coerce.boolean().default(false),
DB_SSL_REJECT_UNAUTHORIZED: z.coerce.boolean().default(true),
```

**Uso esperado:** `CORS_ORIGINS` separado por comas.

---

## 3. Backend - PrismaService (`backend/src/database/prisma/prisma.service.ts`)

### Cambio

Hacer SSL configurable:

```typescript
super({
  adapter: new PrismaPg({
    connectionString,
    ssl: process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
  }),
})
```

**Impacto:** Más seguro en prod, flexible en local/dev.

---

## 4. Backend - Main (`backend/src/main.ts`)

### Cambios

1. **CORS desde env**

```typescript
const corsOrigins = (config.get<string>('CORS_ORIGINS') || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...corsOrigins,
  /\.vercel\.app$/,
];
```

2. **Helmet con CSP (básico)**

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'script-src': ["'self'", "'unsafe-inline'"], // ajustar si strict
        'style-src': ["'self'", "'unsafe-inline'"],
        'connect-src': ["'self'"],
      },
    },
  }),
);
```

**Nota:** Si frontend usa inline scripts estrictos, ajustar. Para MVP aceptable.

---

## 5. Backend - Guards

### 5.1 `subscription-limit.guard.ts`

**Eliminar dependencia de header.** Usar solo usuario autenticado.

```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const companyId = request.user?.companyId;

  if (!companyId) {
    return true; // o lanzar Forbidden si recurso requiere tenant
  }

  const resource = this.reflector.get<ResourceType>(
    LIMIT_RESOURCE_KEY,
    context.getHandler(),
  );

  if (!resource) return true;

  try {
    await this.limitService.validateLimit(companyId, resource);
    return true;
  } catch (error) {
    if (error instanceof ForbiddenException) throw error;
    return true;
  }
}
```

**Importante:** No leer `request.headers['x-company-id']`. Esto cierra el bypass.

### 5.2 `tenant.guard.ts` (opcional pero recomendado)

Añadir logging/auditoría si se bloquea por estado (no obligatorio, pero útil).

---

## 6. Backend - Auth Module

### 6.1 DTOs (`auth/dto/auth.dto.ts`)

Añadir:

```typescript
export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
```

(Ya existe ResetPasswordDto parcialmente, revisar consistencia).

### 6.2 AuthService (`auth.service.ts`)

**Nuevas dependencias:** `randomBytes`, `createHash` (crypto) o usar cuid + expiry.

**Añadir métodos:**

- `async changePassword(userId: string, oldPassword: string, newPassword: string)` – verificar oldPassword con argon2, actualizar hash.
- `async forgotPassword(email: string)` – si existe usuario, generar token temporal (hex/uuid), guardar con `expiresAt = now + 15min`, enviar email (EmailService). **NO** revelar existencia.
- `async resetPassword(token: string, password: string)` – validar token no usado/expirado, actualizar password, invalidar token(s).

**Refresh Token Rotation:**

Crear `RefreshTokenService` o lógica directa con Prisma.

Flujo propuesto:
1. En `login()` generar `familyId = cuid()`, guardar refresh token hash + familyId + expiry (7-30d) + ip/userAgent.
2. En `refresh()` recibir refresh token → buscar por hash → si revocado o reemplazado → revocar toda familia (reuse detection) + 401.
3. Si válido → generar nuevo access+refresh, guardar nuevo con `replacedBy`, revocar antiguo.
4. En `logout()` → revocar token recibido si existe.

**Hash tokens:** usar `crypto.createHash('sha256').update(token).digest('hex')`.

### 6.3 AuthController (`auth.controller.ts`)

Añadir endpoints:

```typescript
@UseGuards(JwtAuthGuard)
@Post('change-password')
changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
  return this.authService.changePassword(user.sub, dto.oldPassword, dto.newPassword);
}

@Public()
@Post('forgot-password')
forgotPassword(@Body() dto: ForgotPasswordDto) {
  return this.authService.forgotPassword(dto.email);
}

@Public()
@Post('reset-password')
resetPassword(@Body() dto: ResetPasswordDto) {
  return this.authService.resetPassword(dto.token, dto.password);
}
```

### 6.4 Rate Limiting Auth

Crear guard/decorator específico o usar `@Throttle()` de `@nestjs/throttler`.

Aplicar a:
- `POST /auth/login` → 5 req/min (o 10/5min)
- `POST /auth/register` → 3 req/min
- `POST /auth/refresh` → 20 req/min
- `POST /auth/forgot-password` → 3 req/min
- `POST /auth/reset-password` → 3 req/min

Ejemplo: `@Throttle({ default: { limit: 5, ttl: 60_000 } })` a nivel handler/clase.

---

## 7. Backend - SubscriptionLimitService (Revisar)

**Archivo:** `subscription-limit.service.ts`

- Revisar `sales: 0` (líneas 76-78, 148-149, 157-158). Si no hay límite definido, ok. Si se desea limitar, mapear a campo real.
- Verificar lógica para planes FREE vs TRIALING vs ACTIVE (línea 31-51). TRIALING: ¿debe tener límites? Actualmente solo ACTIVE aplica límites "completos". Considerar trial con límites razonables.

---

## 8. Frontend - Auth API (`frontend/lib/api/auth.ts`)

### Cambios CRÍTICOS (Cookie-only)

1. **Eliminar localStorage usage**

```typescript
// ELIMINAR
export function setTokens(...){...}
export function getAccessToken(){...}
export function getRefreshToken(){...}
export function clearTokens(){...}
export function isAuthenticated(){...}
```

2. **getMe sin Bearer**

```typescript
export async function getMe(): Promise<AuthResponse['user']> {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: 'include',
  });

  return handleResponse<AuthResponse['user']>(response);
}
```

3. **login/register/refresh/logout ya usan credentials: 'include'** – OK. Quitar lógica que depende de tokens locales.

4. **refreshToken** – puede leer refresh token desde cookie httpOnly? Si lo enviamos por body también OK (backend acepta). Con cookie-only, opcional enviar body vacío.

### Auth Store (`frontend/stores/auth.store.ts`)

Actualizar:

```typescript
checkAuth: async () => {
  set({ isLoading: true });
  try {
    const user = await getMe();
    set({ user, isAuthenticated: true, isLoading: false });
  } catch {
    set({ user: null, isAuthenticated: false, isLoading: false });
  }
},
```

Quitar referencias a `getAccessToken`, `setTokens`, `clearTokens`.

---

## 9. Frontend - API Client/Interceptores

### Buscar archivos con localStorage

Revisar:
- `frontend/lib/api/*.ts`
- `frontend/utils/*.ts`
- Cualquier `localStorage.getItem('accessToken'|'refreshToken')`

**Objetivo:** Eliminar por completo acceso a estos keys.

Si existe `interceptor.ts` para refresh automático:
- Debe llamar `POST /auth/refresh` con `credentials: 'include'`
- Al recibir 401 en request → intentar refresh → reintentar request original
- Si refresh falla → redirigir a `/sign-in`

---

## 10. Frontend - Middleware

### Evaluar `frontend/middleware.ts` raíz

Actualmente solo existe `utils/supabase/middleware.ts`. Crear `frontend/middleware.ts` si se desea proteger rutas server-side con cookie check.

**Sugerido simple:**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/sign-in','/sign-up','/forgot-password','/reset-password','/pricing','/_next','/favicon.ico'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();
  
  const hasAccess = req.cookies.has('access_token');
  if (!hasAccess) return NextResponse.redirect(new URL('/sign-in', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

**Nota:** Valida existencia de cookie (no firma). Validación real sigue en backend. Esto mejora UX.

### Limpiar Supabase

Si `utils/supabase/*` NO se usa con auth propio → eliminar para evitar confusión.

---

## 11. Seguridad Hardening - Checklist

| Item | Archivo | Acción |
|---|---|---|
| **CSP Helmet** | `main.ts` | Añadir contentSecurityPolicy (ajustar connect-src si cross-origin). |
| **CORS env** | `main.ts` + `env.ts` | Leer `CORS_ORIGINS` desde env. |
| **SSL Prisma** | `prisma.service.ts` + `env.ts` | Configurable. |
| **Rate limit auth** | `auth.controller.ts` o module | Añadir `@Throttle()` específico. |
| **Cookie sameSite** | `auth.controller.ts` (setAuthCookies) | Evaluar `sameSite: 'none'` + `secure: true` si frontend-backend cross-site (Vercel + Render). Si mismo dominio `lax` OK. |
| **Cookie secure** | `auth.controller.ts` | Ya depende de `NODE_ENV==='production'`. OK con `none` requiere `secure:true`. |

---

## 12. Auditoría - Integrar AuditLog

**Archivos a modificar:** Servicios con mutaciones críticas.

| Servicio | Métodos | Acción |
|---|---|---|
| **SalesService** | create, update, cancel/refund | Registrar: action CREATE/UPDATE/DELETE, entity 'Sale', entityId, changes (diff), ip/userAgent desde request. |
| **ProductsService** | create, update, delete/soft-delete | AuditLog |
| **CustomersService** | create, update, delete | AuditLog |
| **EmployeesService** | create, update, delete | AuditLog |
| **UsersService/Memberships** | cambios roles/estado | AuditLog (importante) |
| **Inventory/Movements** | crear movimiento | AuditLog |
| **Subscriptions/Billing** | aprobar/rechazar/upgrade | AuditLog |

**Recomendado:** Crear `AuditService` reutilizable (`audit.log({companyId,userId,action,entity,entityId,changes,ip,userAgent})`).

---

## 13. Orden de Aplicación Sugerido

Ejecutar en este orden para minimizar riesgo:

| Paso | Acción | Verificación |
|---|---|---|
| **1.** | Editar `schema.prisma` (unicidades + RefreshToken + deletedAt) | Compilar schema sin errores. |
| **2.** | `prisma format && prisma migrate dev` | Migración aplica correctamente. Revisar datos conflictivos. |
| **3.** | `env.ts` + `prisma.service.ts` + `main.ts` (CORS/Helmet/SSL) | Build backend OK. |
| **4.** | `subscription-limit.guard.ts` (quitar header) | Guards compilando. |
| **5.** | Auth DTOs/Service/Controller + RefreshToken rotation | Login/refresh/logout funcional. |
| **6.** | Rate limiting auth | Endpoints protegidos. |
| **7.** | Frontend `auth.ts` + `auth.store.ts` (cookie-only) | Login fluye sin localStorage. |
| **8.** | Revisar interceptores + middleware frontend | Refresh automático OK. |
| **9.** | Integrar AuditLog en servicios clave | Logs generándose. |

---

## 14. Archivos Afectados (Resumen)

### Backend
- `backend/prisma/schema.prisma`
- `backend/src/config/env.ts`
- `backend/src/database/prisma/prisma.service.ts`
- `backend/src/main.ts`
- `backend/src/common/guards/subscription-limit.guard.ts`
- `backend/src/modules/auth/dto/auth.dto.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.module.ts` (añadir dependencias si aplica)
- `backend/src/common/services/audit.service.ts` (nuevo - opcional pero recomendado)
- Servicios críticos para AuditLog

### Frontend
- `frontend/lib/api/auth.ts`
- `frontend/stores/auth.store.ts`
- `frontend/lib/api/*` (buscar localStorage)
- `frontend/middleware.ts` (crear si no existe)
- `frontend/utils/supabase/*` (eliminar si no usado)

### Docs
- `docs/revisión-sistema-completo-y-plan-mejoras.md` (ya creado)
- `docs/plan-detallado-por-archivo.md` (este archivo)