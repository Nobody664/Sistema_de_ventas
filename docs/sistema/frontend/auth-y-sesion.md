# Área: Autenticación y sesión

Documenta las páginas públicas de sesión y estado de cuenta, los componentes de
`frontend/components/auth/`, el store de sesión y las utilidades de sesión/permisos.
El backend asociado está en `docs/sistema/backend/auth.md`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/sign-in` | `frontend/app/sign-in/page.tsx` | server | Envuelve a `SignInPageClient`. |
| `/sign-in` (contenido) | `frontend/app/sign-in/sign-in-client.tsx` | client | Layout de dos columnas; renderiza `SignInForm` dentro de `Suspense`. |
| `/sign-up` | `frontend/app/sign-up/page.tsx` | server | Envuelve a `SignUpPageClient` dentro de `Suspense`. |
| `/sign-up` (contenido) | `frontend/app/sign-up/sign-up-client.tsx` | client | Layout de registro; renderiza `SignUpForm`. |
| `/forgot-password` | `frontend/app/forgot-password/page.tsx` | server | Envuelve a `ForgotPasswordPageClient`. |
| `/forgot-password` (contenido) | `frontend/app/forgot-password/forgot-password-client.tsx` | client | Layout de recuperación; renderiza `ForgotPasswordForm`. |
| `/reset-password` | `frontend/app/reset-password/page.tsx` | server | Envuelve a `ResetPasswordPageClient` dentro de `Suspense`. |
| `/reset-password` (contenido) | `frontend/app/reset-password/reset-password-client.tsx` | client | Layout de nueva contraseña; renderiza `ResetPasswordForm`. |
| `/forbidden` | `frontend/app/forbidden/page.tsx` | server | Página estática de acceso denegado; enlaces a `/dashboard` y `/sign-in`. |
| `/plan-expired` | `frontend/app/plan-expired/page.tsx` | server | Aviso de prueba/plan expirado; enlaces a `/pricing` y `/sign-in`. |
| `/account-suspended` | `frontend/app/account-suspended/page.tsx` | server | Aviso de cuenta suspendida por falta de pago; enlace a `/sign-in`. |
| `/checkout` | `frontend/app/checkout/page.tsx` | client | Flujo de compra/cambio de plan (resumen, datos, pago con comprobante, éxito). Usa `Suspense`. |
| `/supabase-test` | `frontend/app/supabase-test/page.tsx` | server (async) | Página de prueba que consulta la tabla `todos` de Supabase. |
| `/api/auth/register` | `frontend/app/api/auth/register/` | — | Solo existe el directorio; no contiene archivo de ruta (ver Notas). |

## Componentes

- `frontend/components/auth/sign-in-form.tsx` — `SignInForm`: formulario email/contraseña con react-hook-form + zod (`signInSchema`). Llama a `useAuthStore.login`, redirige con `safeRedirect` desde `?redirect`.
- `frontend/components/auth/sign-up-form.tsx` — `SignUpForm`: registro con validación de nombre, empresa, email, celular (`+51`), contraseña (mayúscula, número, símbolo) y confirmación; requisitos de contraseña en vivo. Llama a `useAuthStore.register` y navega a `/dashboard`.
- `frontend/components/auth/forgot-password-form.tsx` — `ForgotPasswordForm`: envía email a `/api/auth/forgot-password` vía `fetch` directo; en éxito muestra mensaje genérico y, si el backend devuelve `devToken` (desarrollo), muestra enlace a `/reset-password?token=...`.
- `frontend/components/auth/reset-password-form.tsx` — `ResetPasswordForm`: lee `?token=` y hace `fetch` a `/api/auth/reset-password`; valida longitud mínima 8 y coincidencia; redirige a `/sign-in` tras éxito.
- `frontend/components/auth/auth-hydrator.tsx` — `AuthHydrator`: componente nulo que ejecuta `checkAuth()` al montar (se renderiza en `app/providers.tsx`).
- `frontend/components/auth/page-guard.tsx` — `PageGuard`: protege por `requiredPermissions` y/o `requiredRoles`; si no hay acceso y no hay `fallback`, redirige a `/forbidden`.
- `frontend/components/auth/permission-guard.tsx` — `PermissionGuard`: renderiza `children` solo si el usuario tiene un `permission`; si no, muestra `fallback` (por defecto `null`).

## Llamadas al backend

Todas las rutas relativas `/api/*` se reescriben al backend mediante `next.config.ts`
(`source: '/api/:path*'` → `${BACKEND_URL}/api/:path*`).

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `SignInForm` | `POST /api/auth/login` | `login()` en `frontend/lib/api/auth.ts` (vía `useAuthStore.login`) | `credentials: 'include'`; setea cookies de sesión. |
| `SignUpForm` | `POST /api/auth/register` | `register()` en `frontend/lib/api/auth.ts` (vía `useAuthStore.register`) | Envía `{ email, password, fullName, companyName }`. |
| `ForgotPasswordForm` | `POST /api/auth/forgot-password` | `fetch` directo (no usa `apiFetch`/store) | `credentials: 'include'`; lee `{ message, devToken }`. |
| `ResetPasswordForm` | `POST /api/auth/reset-password` | `fetch` directo | Envía `{ token, password }`; `credentials: 'include'`. |
| `AuthHydrator` → `checkAuth` | `GET /api/auth/me` | `getMe()` en `frontend/lib/api/auth.ts` | Restaura usuario al cargar. |
| `auth.store.refreshSession` | `POST /api/auth/refresh` | `refreshToken()` en `frontend/lib/api/auth.ts` | Rota sesión y vuelve a llamar `getMe`. |
| `AppHeader` (logout) | `POST /api/auth/logout` | `logout()` en `frontend/lib/api/auth.ts` | Limpia estado local aunque falle. |
| `getServerSession` (layout dashboard/platform) | `GET /api/auth/me` | `fetch` con `Authorization: Bearer <access_token>` | Lee cookie `access_token`; `cache: 'no-store'`. |
| `CheckoutPage` | `GET /api/plans` | `apiFetch<Plan[]>('/plans')` | Carga planes y precios. |
| `CheckoutPage` | `GET /api/payment-settings` | `apiFetch<PaymentSettings[]>('/payment-settings')` | Filtra por `isEnabled` para habilitar YAPE/PLIN/TRANSFER. |
| `CheckoutPage` | `POST /api/payments/checkout/requests` | `apiFetch('/payments/checkout/requests', { method: 'POST', token })` | Crea la solicitud; devuelve `{ requestId, status }`. |
| `CheckoutPage` | `POST /api/payments/checkout/requests/:id/proof` | `apiFetch('/payments/checkout/requests/:id/proof', { method: 'POST', token })` | Sube `{ imageBase64 }` del comprobante. |
| `/supabase-test` | Supabase `from('todos').select()` | `createClient(cookieStore)` de `frontend/utils/supabase/server.ts` | No usa el backend NestJS; consulta Supabase directamente. |

## Estado global

- `frontend/stores/auth.store.ts` — store Zustand `useAuthStore`: estado `user`, `isAuthenticated`, `isLoading`, `error`; acciones `login`, `register`, `logout`, `updateProfile`, `checkAuth`, `refreshSession`, `clearError`. No usa persistencia.
- `frontend/hooks/useAuth.ts` — `useAuth()`: reexpone selectores y acciones del store (`user`, `isAuthenticated`, `isLoading`, `error`, `login`, `register`, `logout`, `checkAuth`, `clearError`).
- `frontend/hooks/usePermissions.ts` — `usePermissions()`: calcula `hasPermission`, `hasAnyPermission`, `hasAllPermissions` y flags `isAdmin`, `isManager`, `isCashier`, `isSuperAdmin` desde `user.roles`.
- `frontend/types/permissions.ts` — tipo `Permission` (unión de strings) y `ROLE_PERMISSIONS: Record<string, Permission[]>` para `SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `CASHIER`, `VIEWER`, `SUPPORT_ADMIN`.
- `frontend/lib/session.ts` — `getServerSession()` (envuelto en `cache`): lee cookies `access_token`/`refresh_token` y consulta `/auth/me`; devuelve `{ user, accessToken, refreshToken }` o `null`.
- `frontend/lib/api/auth.ts` — cliente de auth (`login`, `register`, `logout`, `getMe`, `updateProfile`, `refreshToken`), interfaces `LoginRequest`, `RegisterRequest`, `AuthResponse`, `AuthUser`, `RefreshResponse` y `AuthApiError`.
- `frontend/app/providers.tsx` — proveedores de React Query y `next-themes`, y monta `AuthHydrator`.

## Flujo de usuario

1. El usuario abre `/sign-in` y envía email/contraseña (`SignInForm`).
2. `useAuthStore.login` llama a `POST /api/auth/login`; el backend setea cookies y devuelve `user`.
3. El store guarda `user`/`isAuthenticated`; el formulario navega a `safeRedirect(?redirect)` o `/dashboard`.
4. En cada carga, `AuthHydrator` (montado en `providers.tsx`) ejecuta `checkAuth` → `GET /api/auth/me` para rehidratar la sesión.
5. Si el usuario no está autenticado y entra a una ruta privada, `frontend/proxy.ts` (middleware) redirige a `/sign-in?redirect=<ruta>`.
6. Registro: `/sign-up` valida los campos y llama a `POST /api/auth/register`, luego navega a `/dashboard`.
7. Recuperación: `/forgot-password` → `POST /api/auth/forgot-password`; en desarrollo muestra el enlace `devToken`; `/reset-password?token=...` → `POST /api/auth/reset-password` y redirige a `/sign-in`.
8. Checkout: `/checkout?plan=CODIGO` carga plan y métodos de pago; sin sesión solicita datos de empresa (y RUC/dirección si el plan es de pago); crea la solicitud de pago y sube el comprobante; muestra pantalla de éxito.

## Notas

- `frontend/proxy.ts` aplica guardas en middleware antes de renderizar: rutas públicas (`PUBLIC_ROUTES`), redirección a `/sign-in` sin cookie `access_token`, redirección a `/forbidden` si la ruta `/platform/*` y el JWT no tiene `SUPER_ADMIN`/`SUPPORT_ADMIN`, y redirección a `/plan-expired` (`companyStatus === 'INACTIVE'`) o `/account-suspended` (`SUSPENDED`/`PAST_DUE`). Lee los claims `roles` y `companyStatus` del JWT (base64url).
- `frontend/app/(dashboard)/layout.tsx` y `frontend/app/(platform)/layout.tsx` repiten la protección del lado servidor con `getServerSession()` y `redirect(...)`.
- `frontend/app/api/auth/register/` existe como directorio vacío: no contiene archivo `route.ts` ni handler. Las llamadas a `/api/auth/register` se resuelven por el rewrite de `next.config.ts` hacia el backend.
- `getAccessToken`, `getRefreshToken` e `isAuthenticated` de `frontend/lib/api/auth.ts` son stubs: devuelven `undefined`/`undefined`/`false` respectivamente (la sesión real vive en cookies httpOnly). Por eso `checkout/page.tsx` obtiene `accessToken` de `getAccessToken()` (queda `undefined`) y `apiFetch` sigue usando `credentials: 'include'`.
- `CheckoutPage` determina autenticación por `!!user?.companyId` (no por `isAuthenticated`).
- `safeRedirect` en `SignInForm` rechaza destinos que no empiezan con `/`, que empiezan con `//` o con `/sign-in`, y en esos casos usa `/dashboard`.
- Los formularios de forgot/reset usan `fetch` directo (no `apiFetch`) porque están fuera del ciclo de refresco de token.
