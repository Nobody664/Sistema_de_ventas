# Área: Configuración y cuenta

Agrupa la configuración de la aplicación, los datos de empresa, el perfil de
usuario, las notificaciones, los pagos/suscripción y la página pública de
precios. Ruta del código: `frontend/app/(dashboard)/`, `frontend/app/(marketing)/`
y `frontend/components/settings|profile|payments|notifications|subscriptions|plan-capabilities|plans`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/settings` | `frontend/app/(dashboard)/settings/page.tsx` | server (async component) | Hub de configuración. Lee la sesión y arma `settingsSections` (Empresa, Apariencia, Regional, Notificaciones, Datos, API). Muestra la sección "Pagos" si el usuario es `SUPER_ADMIN` (enlaza a `/platform/settings/payment`) o la sección "Suscripción" si es `COMPANY_ADMIN` (enlaza a `/subscription`). Incluye `ProfileCompletenessIndicator` y un bloque "Zona de peligro". |
| `/settings/company` | `frontend/app/(dashboard)/settings/company/page.tsx` | client (`'use client'`) | Formulario de datos de empresa (nombre, razón social, RUC, dirección, email, teléfono). Solo editable por `COMPANY_ADMIN` (muestra "Acceso restringido" en caso contrario). Usa React Query. |
| `/profile` | `frontend/app/(dashboard)/profile/page.tsx` | server (async component) | Si el usuario es `SUPER_ADMIN`/`SUPPORT_ADMIN` renderiza `SuperAdminProfileClient`; si no, exige `companyId` y renderiza `ProfileClient` con suscripción y empresa. |
| `/notifications` | `frontend/app/(dashboard)/notifications/page.tsx` | server (async component) | Carga las notificaciones y renderiza `NotificationsClient` con `initialNotifications`, `unreadCount` e `isAdmin`. |
| `/payments` | `frontend/app/(dashboard)/payments/page.tsx` | server (async component) | Redirige a `/sign-in` sin `companyId`. Carga `billing/status`, `payments/current-pending` y `payments/history` y renderiza `PaymentHistoryClient`. |
| `/subscription` | `frontend/app/(dashboard)/subscription/page.tsx` | server (async component) | Redirige a `/sign-in` sin `companyId` y a `/dashboard` si el rol no es `COMPANY_ADMIN`. Carga suscripción, planes, solicitud pendiente y completitud de perfil; renderiza `SubscriptionPageClient`. |
| `/pricing` | `frontend/app/(marketing)/pricing/page.tsx` | client (`'use client'`) | Página pública de planes y precios. Carga los planes activos y lleva a `/sign-up?plan=FREE` o `/checkout`. |

## Componentes

- `frontend/components/settings/payment-settings.tsx` — `PaymentSettingsManager`.
  Gestiona proveedores de pago (`YAPE`, `PLIN`, `TRANSFER`, `STRIPE`,
  `MERCADOPAGO`): activa/desactiva y edita datos (teléfono/titular/QR para
  Yape/Plin, cuenta para Transferencia, API key para Stripe/MercadoPago). Usa
  `apiFetch` y `compressImage`.
- `frontend/components/settings/payment-proof-upload.tsx` —
  `PaymentProofUploader` (`{ subscriptionId, amount, provider, onSuccess? }`).
  Carga los datos de pago del proveedor y sube el comprobante de la suscripción.
- `frontend/components/settings/profile-completeness.tsx` —
  `ProfileCompletenessIndicator`. Consulta la completitud del perfil de empresa y
  muestra un indicador circular con campos faltantes y enlace a
  `/settings/company`. Se oculta si el score es 100 o si falla la carga.
- `frontend/components/profile/profile-client.tsx` — `ProfileClient`. Perfil de
  usuario de empresa: cabecera con iniciales/rol/estado de empresa, menú lateral
  (`/profile`, `/settings/company`, `/subscription` solo `COMPANY_ADMIN`,
  `/notifications`), edición del nombre (vía store de auth) y tarjetas de empresa
  y suscripción.
- `frontend/components/profile/super-admin-profile-client.tsx` —
  `SuperAdminProfileClient`. Panel de perfil para super admin con stats
  (`totalCompanies`, `activeCompanies`, `trialCompanies`, `totalUsers`) y listado
  de empresas; enlaces al área `/platform/*`.
- `frontend/components/payments/payment-history.tsx` — `PaymentHistoryClient`.
  Muestra plan actual, estado de pago, pago pendiente con subida de comprobante y
  el historial de pagos recientes.
- `frontend/components/notifications/notifications-client.tsx` —
  `NotificationsClient`. Lista notificaciones con iconos por tipo, buscador,
  contadores, marcado como leído (individual y masivo) y navegación por tipo
  (`notificationRoutes`).
- `frontend/components/subscriptions/subscription-page-client.tsx` —
  `SubscriptionPageClient`. Muestra el plan actual, sus características, el
  período de prueba, los planes disponibles para upgrade y el uso de API (desde
  `usePlanCapabilities`). Los upgrades navegan a `/checkout?plan=...&upgrade=true`.
- `frontend/components/subscriptions/subscriptions-client.tsx` —
  `SubscriptionsClient`. Vista de gestión de empresas/suscripciones (super admin):
  tarjetas resumen, listado de empresas con suscripción y aprobación/rechazo de
  empresas en prueba. Incluye `CompanyWithPlanModal` para crear empresa con plan.
- `frontend/components/subscriptions/upgrade-plan-modal.tsx` —
  `UpgradePlanModal`. Modal de cambio de plan en 3 pasos (`select` → `payment` →
  `success`): selección de plan/método de pago, subida del comprobante y
  confirmación. Invalida la query `subscription` y refresca la ruta.
- `frontend/components/plan-capabilities/plan-capabilities-provider.tsx` —
  `PlanCapabilitiesProvider` y `usePlanCapabilities`. Contexto con las
  capacidades del plan; expone `can(module)` y `canFeature(feature)` (delegan en
  `frontend/lib/plan-capabilities.ts`). Sin provider devuelve un contexto por
  defecto permisivo.
- `frontend/components/plan-capabilities/plan-route-guard.tsx` —
  `PlanRouteGuard`. Envuelve el contenido del dashboard; según la ruta actual
  (`getRouteRequirement`) decide si renderiza los hijos o `UpgradeRequired`.
- `frontend/components/plan-capabilities/upgrade-required.tsx` —
  `UpgradeRequired`. Pantalla "Función no incluida en tu plan" con enlaces a
  `/dashboard` y (si `canUpgrade`) a `/subscription`.
- `frontend/components/plans/plans-client.tsx` — `PlansClient`. Administración de
  planes (crear/editar/eliminar/activar) para super admin. Alta/edición vía
  diálogo con módulos (`PLAN_MODULE_KEYS`), permisos (`PLAN_FEATURE_KEYS`) y
  ajustes de API.

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `/settings` (server) | — | — | Solo lee la sesión (`getServerSession`); no realiza llamadas al backend en la página. |
| `/settings/company` | `GET /companies/current` | `apiFetch<CompanyData>` (React Query `useQuery`) | Habilitado solo si el usuario es `COMPANY_ADMIN`. |
| `/settings/company` | `PATCH /companies/current` | `apiFetch<CompanyData>` (React Query `useMutation`) | Envía `name`, `legalName`, `taxId`, `address`, `email`, `phone`; valida nombre y RUC de 11 dígitos. |
| `ProfileCompletenessIndicator` | `GET /company-profile/completeness` | `apiFetch<CompletenessData>` | `{ score, totalFields, completedFields, missingFields }`. |
| `/profile` (server, super admin) | `GET /dashboard/global` | `serverApiFetch<DashboardStats>` | Stats globales para `SuperAdminProfileClient`. |
| `/profile` (server, super admin) | `GET /companies` | `serverApiFetch<{ data: Company[]; total }>` | Listado de empresas. |
| `/profile` (server, empresa) | `GET /subscriptions/current` y `GET /companies/current` | `serverApiFetch` (Promise.all) | Datos para `ProfileClient`. |
| `ProfileClient` | `PATCH` de perfil (vía store) | `updateProfile` de `useAuthStore` (`frontend/lib/api/auth`) | Actualiza el nombre del usuario; luego `router.refresh()`. |
| `/notifications` (server) | `GET /notifications` | `serverApiFetch<Notification[]>` | Notificaciones iniciales. |
| `NotificationsClient` | `GET /notifications` | `apiFetch<Notification[]>` (React Query, `initialData`) | Refresco de la lista. |
| `NotificationsClient` | `PATCH /notifications/{id}/read` | `apiFetch` (`useMutation`) | Marca una notificación como leída; invalida `notifications` y refresca el contador. |
| `NotificationsClient` | `PATCH /notifications/read-all` | `apiFetch` (`useMutation`) | Marca todas como leídas. |
| `/payments` (server) | `GET /billing/status` | `serverApiFetch<BillingStatus>` | Suscripción, pago pendiente, último pago y pagos recientes. |
| `/payments` (server) | `GET /payments/current-pending` | `serverApiFetch` | Pagos pendientes. |
| `/payments` (server) | `GET /payments/history` | `serverApiFetch<{ data; total }>` | Historial de pagos. |
| `PaymentHistoryClient` | `POST /payments/{id}/proof` | `apiFetch` (`{ imageBase64 }`) | Sube el comprobante del pago pendiente; tras el éxito hace `router.refresh()`. |
| `/subscription` (server) | `GET /subscriptions/current` | `serverApiFetch<Subscription>` | Suscripción actual. |
| `/subscription` (server) | `GET /plans` | `serverApiFetch<Plan[]>` | Planes disponibles. |
| `/subscription` (server) | `GET /subscriptions/upgrade-requests/my/pending` | `serverApiFetch<PlanUpgradeRequest | null>` | Solicitud de upgrade pendiente. |
| `/subscription` (server) | `GET /company-profile/completeness` | `serverApiFetch<ProfileCompleteness>` | Completitud del perfil. |
| `SubscriptionPageClient` | — | `router.push('/checkout?plan=...&upgrade=true')` | No llama al backend; delega en checkout. |
| `SubscriptionsClient` | `POST /companies/{id}/approve` | `apiFetch` | Aprueba una empresa en prueba. |
| `SubscriptionsClient` | `POST /companies/{id}/reject` | `apiFetch` | Rechaza una empresa en prueba. |
| `CompanyWithPlanModal` | `POST /companies/with-plan` | `apiFetch` | Crea una empresa con plan (queda pendiente de aprobación). |
| `UpgradePlanModal` | `GET /payment-settings` | `apiFetch<PaymentSettings[]>` | Datos de los proveedores habilitados. |
| `UpgradePlanModal` | `POST /subscriptions/upgrade-requests` | `apiFetch<UpgradeResponse>` | Inicia la solicitud de cambio de plan (`{ plan, paymentMethod }`). |
| `UpgradePlanModal` | `POST /subscriptions/upgrade-requests/{id}/proof` | `apiFetch` (`{ imageBase64 }`) | Sube el comprobante; invalida la query `subscription`. |
| `PaymentSettingsManager` | `GET /payment-settings` | `apiFetch<PaymentSettings[]>` | Lista de configuración de proveedores. |
| `PaymentSettingsManager` | `PATCH /payment-settings/provider/{provider}` | `apiFetch` | Activa/desactiva o guarda datos del proveedor. |
| `PaymentProofUploader` | `GET /payment-settings/provider/{provider}` | `apiFetch<PaymentSettings>` | Datos/instrucciones del proveedor. |
| `PaymentProofUploader` | `POST /payment-settings/proof/{subscriptionId}` | `apiFetch` (`{ imageBase64, amount }`) | Sube el comprobante de la suscripción. |
| `/pricing` | `GET /plans` | `apiFetch<Plan[]>` | Carga planes y filtra `isActive`. |
| `PlansClient` | `GET /plans` | `apiFetch<AdminPlan[]>` | Lista/recarga planes (también recargada tras altas, borrados y toggles). |
| `PlansClient` | `POST /plans` | `apiFetch<AdminPlan>` | Crea un plan (`AbortSignal.timeout(20_000)`). |
| `PlansClient` | `PATCH /plans/{id}` | `apiFetch<AdminPlan>` | Edita un plan o alterna `isActive`. |
| `PlansClient` | `DELETE /plans/{id}` | `apiFetch` | Elimina un plan (no permitido para `FREE`). |

## Estado global

- `frontend/stores/auth.store.ts` — `useAuthStore`: `user`, `isAuthenticated`,
  `isLoading`, `error`; acciones `login`, `register`, `logout`, `updateProfile`,
  `checkAuth`, `refreshSession`, `clearError`. Usado por `ProfileClient`,
  `CompanySettingsPage` y los componentes de suscripción/pagos.
- `frontend/store/ui-store.ts` — `useUiStore`: `addToast` y estado del sidebar.
- `frontend/store/notifications-store.ts` — `useNotificationsStore`: lista,
  `unreadCount`, `fetchUnreadCount`, `markAsRead`, `markAllAsRead`,
  `connectToStream` (SSE `GET /api/notifications/stream`) y `addNotification`.
- Providers globales (`frontend/app/providers.tsx`): `QueryClientProvider`
  (`@tanstack/react-query`) y `ThemeProvider` (`next-themes`), usados por las
  páginas con React Query (settings/company, notificaciones, planes, suscripción).
- `PlanCapabilitiesProvider` se monta en `frontend/app/(dashboard)/layout.tsx`
  con las capacidades de `GET /plan-capabilities/me`
  (`fetchPlanCapabilities` en `frontend/lib/plan-capabilities-server.ts`).
  `PlanRouteGuard` envuelve el contenido del dashboard para el gating por plan.

## Flujo de usuario

1. El usuario entra a `/settings` y ve las secciones de configuración; según su
   rol ("Pagos" para `SUPER_ADMIN` o "Suscripción" para `COMPANY_ADMIN`) accede a
   las páginas relacionadas.
2. En `/settings/company` (solo `COMPANY_ADMIN`) edita los datos de la empresa y
   guarda; se actualiza la caché de `company-current` y se muestra un toast. El
   indicador de completitud (`ProfileCompletenessIndicator`) guía los campos
   faltantes.
3. En `/profile` el usuario edita su nombre y consulta datos de empresa y
   suscripción; los super admin ven stats y listado de empresas.
4. En `/notifications` el usuario revisa sus notificaciones, las busca, las marca
   como leídas y navega al área correspondiente según el tipo.
5. En `/payments` el usuario ve su suscripción e historial; si hay un pago
   pendiente sin comprobante, sube una imagen y la envía para verificación.
6. En `/subscription` el usuario ve su plan actual e inicia un upgrade de plan
   (navega a `/checkout`), siempre que su perfil esté completo. Una solicitud
   pendiente bloquea nuevos upgrades.
7. En `/pricing` (público) el visitante compara planes y continúa a registro
   gratis o a checkout.
8. Un administrador de plataforma gestiona planes y métodos de pago globales
   (véase `plataforma.md`).

## Notas

- La subida de imágenes de comprobantes se comprime en el cliente con
  `compressImage` (`frontend/lib/image-compression.ts`) antes de enviarse en
  base64.
- `serverApiFetch` devuelve `null` cuando falta `accessToken` o la petición
  falla, por lo que varias páginas server manejan valores por defecto/`?? []`.
- `subscriptions-client.tsx` está orientado a super admin (aprobación de
  empresas y creación con plan); no se ha verificado en el código una ruta
  dedicada que lo consuma dentro de `frontend/app/(platform)` (sí se usa
  `SubscriptionsClient` como componente de listado de empresas/suscripciones).
- El gating por plan usa `frontend/lib/plan-capabilities.ts`: `CORE_MODULES`
  (`dashboard`, `notifications`) siempre permitidos, con módulos y features
  declarados por el plan. Las rutas con requisito declarado son
  `/inventory/kardex`, `/inventory/batches`, `/distributors` y `/employees`.
- No se ha verificado en el código la implementación de las acciones de
  "Zona de peligro" (eliminar cuenta / cancelar suscripción): los botones no
  tienen `onClick` ni `apiFetch` asociado.
