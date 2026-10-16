# Área: Dashboard

Panel principal de la aplicación. Se adapta al rol del usuario: muestra una consola operativa
para el tenant y una consola de plataforma (métricas globales y de suscripciones) si el usuario
tiene rol `SUPER_ADMIN` o `SUPPORT_ADMIN`. La carga de datos se hace en el servidor y el render
interactivo en un componente cliente.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/dashboard` | `frontend/app/(dashboard)/dashboard/page.tsx` | server (async con `Suspense`) | Obtiene la sesión server-side y precarga métricas de tenant (y globales de plataforma si aplica) mediante `serverApiFetch`; pasa los datos a `DashboardClient`. Incluye `DashboardSkeleton` como fallback. |

## Componentes

- `frontend/components/dashboard/dashboard-client.tsx` — componente cliente que renderiza el panel completo. Con `isSuperAdmin` muestra métricas globales (empresas, MRR, ARR, cobrado), actividad de auditoría reciente, suscripciones recientes y tarjetas de empresas/finanzas; en caso contrario muestra métricas de tenant (ventas/ingresos de hoy, stock bajo, valor de inventario, analítica de ventas, estado de stock, métodos de pago, productos más vendidos y mejores clientes). Lee `user` de `useAuthStore`.
- `frontend/components/charts/revenue-chart.tsx` — componente cliente que dibuja un `AreaChart` de Recharts (área de ingresos) con datos **hardcodeados** en el propio archivo (`Lun`..`Dom`). No consume el backend.
- `frontend/components/common/subscription-usage.tsx` — componente cliente con barras de uso del plan para `products`, `customers`, `employees` y `categories`. Usa el hook `useSubscriptionLimits` y pinta alertas cuando el porcentaje es >= 80% o >= 100%. (No se encontró referencia a este componente desde los archivos del área de dashboard; la usan otras áreas.)

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `dashboard/page.tsx` | `GET /api/dashboard/tenant` | `serverApiFetch` | Siempre se solicita; `tenantId`/`companyId` provienen del token del servidor. |
| `dashboard/page.tsx` | `GET /api/dashboard/global` | `serverApiFetch` | Solo si el usuario es `SUPER_ADMIN`/`SUPPORT_ADMIN`. |
| `dashboard/page.tsx` | `GET /api/audit/global` | `serverApiFetch` | Solo super admin; usa `items` de la respuesta. |
| `dashboard/page.tsx` | `GET /api/subscriptions/subscribers` | `serverApiFetch` | Solo super admin; aplana `data[].subscription` para las suscripciones recientes. |
| `subscription-usage.tsx` | `GET /api/products/limits` | `useSubscriptionLimits` → `apiFetch` | Para recurso `products` y también para `categories` (el hook fuerza `products`). |
| `subscription-usage.tsx` | `GET /api/employees/limits` | `useSubscriptionLimits` → `apiFetch` | Recurso `employees`. |
| `subscription-usage.tsx` | `GET /api/customers/limits` | `useSubscriptionLimits` → `apiFetch` | Recurso `customers`. |
| `revenue-chart.tsx` | — | — | Sin llamadas al backend. |

## Estado global

- `useAuthStore` (`frontend/stores/auth.store.ts`): `user` usado en `dashboard-client.tsx` (aunque las props determinan el modo super admin).
- `useSubscriptionLimits` (`frontend/hooks/use-subscription-limits.ts`): hook con estado local (`limits`, `loading`, `error`) y `fetchLimits`; usado por `subscription-usage.tsx`.
- Providers globales (`frontend/app/providers.tsx`): `QueryClientProvider` (React Query) y `ThemeProvider` (next-themes). El layout `(dashboard)` envuelve las páginas con `PlanCapabilitiesProvider` y `PlanRouteGuard`.

## Flujo de usuario

1. El usuario navega a `/dashboard`.
2. El layout `(dashboard)` verifica sesión; si no hay sesión redirige a `/sign-in`.
3. `DashboardPage` renderiza el fallback `DashboardSkeleton` mientras `DashboardDataLoader` (server) resuelve los `serverApiFetch`.
4. `DashboardDataLoader` obtiene `/dashboard/tenant`; si el usuario es super admin, obtiene además global, auditoría y suscriptores en paralelo.
5. Se renderiza `DashboardClient` con las props; el cliente decide el conjunto de tarjetas (super admin vs. operativo) y los bloques mostrados.
6. Si el usuario es super admin, el gráfico `RevenueChart` se pinta dentro de un `ErrorBoundary`.

## Notas

- `salesAnalytics.weekly` viene siempre vacío desde el backend (ver `docs/sistema/backend/dashboard.md`); el UI no lo usa directamente.
- El porcentaje "+12.5%" del bloque de ingresos del super admin está **hardcodeado** en `dashboard-client.tsx`.
- El gráfico de ingresos no usa datos reales: el dataset está definido en `revenue-chart.tsx`.
- `subscription-usage.tsx` no aparece importado por los archivos del área de dashboard (no verificado que se renderice aquí).
