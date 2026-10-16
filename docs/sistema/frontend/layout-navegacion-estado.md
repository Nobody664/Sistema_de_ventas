# Área: Layout, navegación y estado

Documenta los layouts de la aplicación y la plataforma, los componentes de
`frontend/components/layout/`, los componentes comunes (`toast`, `delete-dialog`) y
los stores de UI y notificaciones.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| (raíz) | `frontend/app/layout.tsx` | server | Layout raíz: fuentes, metadata, envuelve en `Providers` y monta `ToastContainer`. |
| (proveedores) | `frontend/app/providers.tsx` | client | `QueryClientProvider` (React Query), `ThemeProvider` (next-themes) y `AuthHydrator`. |
| `(dashboard)/*` | `frontend/app/(dashboard)/layout.tsx` | server | Layout autenticado: `getServerSession`, redirecciones por estado de empresa, `PlanCapabilitiesProvider`, `TrialBanner`, `AppSidebar`, `AppHeader`, `PlanRouteGuard`. |
| `(platform)/*` | `frontend/app/(platform)/layout.tsx` | server | Layout de plataforma: exige rol `SUPER_ADMIN`/`SUPPORT_ADMIN`, `PlatformSidebar`, `AppHeader`. |

Nota: los componentes de este documento no definen rutas propias; se montan desde los
layouts anteriores.

## Componentes

- `frontend/components/layout/app-sidebar.tsx` — `AppSidebar` (aside escritorio) y `AppMobileNav` (Sheet móvil). Comparten `SidebarContent`: menú por roles y por módulo de plan (`usePlanCapabilities().can`). Incluye accesos a Dashboard, Notificaciones, Gestión (Inventario, Productos, Categorías, Ventas, Cupones (solo `COMPANY_ADMIN`), Clientes, Distribuidores, Empleados, Pagos, Reportes) y, para admins de plataforma, enlace a `/platform`.
- `frontend/components/layout/platform-sidebar.tsx` — `PlatformSidebar` y `PlatformMobileNav`. Menú de plataforma (Resumen, Empresas, Suscriptores, Solicitudes, Planes) y bloque de sistema (Plantillas, Pagos globales, Auditoría) filtrado por roles.
- `frontend/components/layout/app-header.tsx` — `AppHeader`: barra superior con `nav` (menú móvil), `ThemeToggle`, `NotificationBell` y menú desplegable de usuario con perfil, Mi Plan (COMPANY_ADMIN), Clientes, Empleados, Configuración y Cerrar sesión (llama `useAuthStore.logout` y navega a `/sign-in`).
- `frontend/components/layout/app-scope.tsx` — `AppScope`: efecto que setea `document.body.dataset.app` mientras está montado (marca de ámbito de app).
- `frontend/components/layout/notification-bell.tsx` — `NotificationBell`: campana con contador de no leídos e indicador de conexión SSE; en montaje llama `fetchUnreadCount` y `connectToStream`, refresca cada 30s y en `focus`/`visibilitychange`; navega a `/notifications`.
- `frontend/components/layout/theme-toggle.tsx` — `ThemeToggle`: alterna tema `light` → `dark` → `system` con `next-themes`; evita desajuste de hidratación con flag `mounted`.
- `frontend/components/layout/trial-banner.tsx` — `TrialBanner`: banner de prueba gratis (visible solo si `companyStatus === 'TRIAL'`, hay `trialEndsAt`, el rol incluye `COMPANY_ADMIN` y quedan días). Cambia a rojo si quedan ≤ 1 día; descartable con estado local.
- `frontend/components/common/toast.tsx` — `ToastContainer`: renderiza `toasts` del `useUiStore` con estilos por tipo (`success`/`error`/`info`) y botón de cierre.
- `frontend/components/common/delete-dialog.tsx` — `DeleteDialog`: diálogo de confirmación de borrado por `entity` (`product`, `customer`, `employee`, `sale`, `category`, `distributor`, `discount`); ejecuta `apiFetch` DELETE, invalida la query de React Query, refresca el router y muestra toast. Acepta `successMessage` opcional para personalizar el toast (lo usa `discount` con "Cupón desactivado correctamente").

Relacionados con el gating de plan (usados por los layouts y el sidebar):
- `frontend/components/plan-capabilities/plan-capabilities-provider.tsx` — `PlanCapabilitiesProvider` / `usePlanCapabilities` (`can(module)`, `canFeature(feature)`).
- `frontend/components/plan-capabilities/plan-route-guard.tsx` — `PlanRouteGuard`: según `getRouteRequirement(pathname)`, muestra `UpgradeRequired` si el plan no cubre la ruta.
- `frontend/components/plan-capabilities/upgrade-required.tsx` — `UpgradeRequired`: pantalla de "función no incluida en tu plan".

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `NotificationBell` | `GET /api/notifications/unread-count` | `apiFetch('/notifications/unread-count')` en `store/notifications-store.ts` | Espera `{ count }`. |
| `NotificationBell` | `GET /api/notifications/stream` (SSE) | `new EventSource('/api/notifications/stream', { withCredentials: true })` | Solo cuando hay `user`; reconexión gestionada por `EventSource`. |
| `notifications-store.fetchNotifications` | `GET /api/notifications` | `apiFetch<Notification[]>('/notifications')` | Actualiza lista y `unreadCount`. |
| `notifications-store.markAsRead` | `PATCH /api/notifications/:id/read` | `apiFetch('/notifications/:id/read', { method: 'PATCH' })` | Decrementa `unreadCount`. |
| `notifications-store.markAllAsRead` | `PATCH /api/notifications/read-all` | `apiFetch('/notifications/read-all', { method: 'PATCH' })` | Marca todo como leído. |
| `AppHeader` (logout) | `POST /api/auth/logout` | `logout()` de `lib/api/auth.ts` | Limpia sesión y redirige a `/sign-in`. |
| `DeleteDialog` | `DELETE /api/products/:id` | `apiFetch(endpoints.product, { method: 'DELETE' })` | Invalida `['products']`. |
| `DeleteDialog` | `DELETE /api/customers/:id` | `apiFetch(..., { method: 'DELETE' })` | Invalida `['customers']`. |
| `DeleteDialog` | `DELETE /api/employees/:id` | `apiFetch(..., { method: 'DELETE' })` | Invalida `['employees']`. |
| `DeleteDialog` | `DELETE /api/sales/:id` | `apiFetch(..., { method: 'DELETE' })` | Invalida `['sales']`. |
| `DeleteDialog` | `DELETE /api/products/categories/:id` | `apiFetch(..., { method: 'DELETE' })` | Invalida `['categories']`. |
| `DeleteDialog` | `DELETE /api/distributors/:id` | `apiFetch(..., { method: 'DELETE' })` | Invalida `['distributors']`. |
| `DeleteDialog` | `DELETE /api/discounts/:id` | `apiFetch(..., { method: 'DELETE' })` | Invalida `['discounts']`; backend desactiva el cupón. |

## Estado global

- `frontend/store/ui-store.ts` — Zustand `useUiStore`: `sidebarOpen`, `sidebarMobileOpen`, `toasts` (`{ id, message, type }`); acciones `addToast` (autoelimina a los 4000 ms), `removeToast`, `toggleSidebar`, `toggleMobileSidebar`, `closeMobileSidebar`, `setSidebarOpen`.
- `frontend/store/notifications-store.ts` — Zustand `useNotificationsStore`: `notifications`, `unreadCount`, `isLoading`, `isConnected`, `eventSource`; acciones `fetchNotifications`, `fetchUnreadCount`, `markAsRead`, `markAllAsRead`, `connectToStream`, `disconnectFromStream`, `addNotification`.
- `frontend/app/providers.tsx` — proveedores globales: React Query (con `staleTime: 60_000`, `refetchOnWindowFocus: false`) y `next-themes`; incluye `AuthHydrator`.
- `frontend/components/plan-capabilities/plan-capabilities-provider.tsx` — contexto de plan (recibe `capabilities` del layout de dashboard).

## Flujo de usuario

1. Al cargar cualquier ruta, `app/layout.tsx` monta `Providers` (React Query + tema) y `ToastContainer`.
2. El layout de área (`(dashboard)` o `(platform)`) resuelve la sesión con `getServerSession()` y redirige si corresponde.
3. `(dashboard)` carga capacidades de plan (`fetchPlanCapabilities`) y las expone con `PlanCapabilitiesProvider`; `AppSidebar` filtra ítems por rol y por `can(module)`.
4. `AppHeader` muestra tema, campana de notificaciones y menú de usuario; `AppScope` marca `body[data-app]`.
5. `TrialBanner` aparece en prueba gratis para administradores; el usuario puede descartarlo.
6. `NotificationBell` consulta el conteo no leído, abre el stream SSE y vuelve a `/notifications` al hacer clic.
7. `PlanRouteGuard` intercepta rutas con requisito de plan y muestra `UpgradeRequired` si el plan no las incluye.
8. `DeleteDialog` se abre desde las acciones de entidad, confirma, elimina, invalida la lista y muestra un toast de éxito o error.

## Notas

- La navegación del sidebar se filtra de forma doble: por `item.roles` (roles del usuario) y por `item.module` con `can(module)` (módulos habilitados del plan).
- `usePlanCapabilities` devuelve una implementación permisiva (`can: () => true`) cuando no hay `PlanCapabilitiesProvider` en el árbol.
- `NotificationBell` no renderiza nada si no hay `user`, y desmonta el intervalo y el stream en el cleanup.
- `TrialBanner` no se muestra si `daysLeft <= 0` aunque `companyStatus` siga siendo `TRIAL`.
- `next.config.ts` redirige rutas heredadas a `/platform/...`: `/payment-settings`, `/settings/payment`, `/companies`, `/subscribers`, `/upgrade-requests`, `/subscriptions`, `/audit`, `/invoices/templates`.
- El layout de dashboard solo redirige por `INACTIVE` y `SUSPENDED` (no por `PAST_DUE`); el middleware `frontend/proxy.ts` sí redirige `PAST_DUE` a `/account-suspended`.
