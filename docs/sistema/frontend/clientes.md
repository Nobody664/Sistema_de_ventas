# Área: Clientes

Documenta el área de clientes del frontend Next.js (App Router). Código en
`frontend/app/(dashboard)/customers/` y `frontend/components/customers/`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/customers` | `frontend/app/(dashboard)/customers/page.tsx` | server | Lista clientes (`GET /customers`), muestra total, nuevos del mes, tarjetas con enlace a detalle y sumatoria de compras. |
| `/customers/new` | `frontend/app/(dashboard)/customers/new/page.tsx` | server | Verifica sesión, redirige a `/sign-in` si no hay usuario y renderiza `CustomerForm` sin cliente (modo creación). |
| `/customers/[id]` | `frontend/app/(dashboard)/customers/[id]/page.tsx` | server | Carga cliente y compras/estadísticas, y renderiza `CustomerDetailClient`. Llama `notFound()` si el cliente no existe. |
| `/customers/[id]/edit` | `frontend/app/(dashboard)/customers/[id]/edit/page.tsx` | server | Carga el cliente y renderiza `CustomerForm` con `customer` (modo edición). Llama `notFound()` si no existe. |

## Componentes

- `frontend/components/customers/customer-form.tsx` — formulario cliente de creación/edición. Valida con `createCustomerSchema` (`frontend/lib/validations/customer.validation.ts`), usa `DniSearch`, hace `POST /customers` o `PATCH /customers/:id`, invalida `['customers']`, muestra toast y navega a `/customers`.
- `frontend/components/customers/customer-actions.tsx` — exporta `CustomerActions` (enlaces a edición con `PermissionGuard permission="customer:update"` y `DeleteDialog entity="customer"` con `customer:delete`) y `NewCustomerButton` (enlace a `/customers/new` con `PermissionGuard permission="customer:create"`).
- `frontend/components/customers/customer-modal.tsx` — componente cliente con `Dialog` para crear/editar cliente mediante validaciones de `frontend/lib/validations` (`validatePhone`, `validateEmail`, `validateTextOnly`, `validateDNI`, `validateRUC`, etc.). Hace `POST/PATCH /customers`.
- `frontend/app/(dashboard)/customers/[id]/customer-detail-client.tsx` — componente cliente de detalle; presenta información personal, estadísticas y el historial de compras con enlaces a `/sales/[id]`.
- `frontend/components/ui/dni-search.tsx` — buscador de DNI/RUC por documento usado por `CustomerForm` (ver llamadas al backend).

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `/customers` (página) | `GET /customers` | `serverApiFetch` | Server component; usa el `accessToken` de `getServerSession`. |
| `/customers/[id]` (página) | `GET /customers/:id` | `serverApiFetch` | Devuelve `Customer`; si falla la página hace `notFound()`. |
| `/customers/[id]` (página) | `GET /customers/:id/purchases` | `serverApiFetch` | Devuelve `{ purchases, stats }`. |
| `/customers/[id]/edit` (página) | `GET /customers/:id` | `serverApiFetch` | Precarga del formulario. |
| `CustomerForm` | `POST /customers` / `PATCH /customers/:id` | `apiFetch` | Método según `isEdit`; body con `documentValue` (el formulario recolecta `documentNumber` y lo envía como `documentValue`). |
| `CustomerForm` (DniSearch) | `GET /dni/:documentNumber` y `GET /dni/ruc/:documentNumber` | `apiFetch` | `documentType === 'DNI'` usa `/dni/...`; en caso contrario `/dni/ruc/...`. |
| `CustomerActions` (DeleteDialog) | `DELETE /customers/:id` | `apiFetch` | `frontend/components/common/delete-dialog.tsx`; invalida `['customers']`. |
| `CustomerModal` | `POST /customers` / `PATCH /customers/:id` | `apiFetch` | Alternativa en diálogo para crear/editar. |
| Toda página protegida | `GET /auth/me` | `getServerSession` (`frontend/lib/session.ts`) | Lee la cookie `access_token`; null si no hay sesión. |

## Estado global

- `useAuthStore` (`frontend/stores/auth.store.ts`) — `user`, `isAuthenticated`; usado por `PermissionGuard` y el formulario/modal.
- `useUiStore` (`frontend/store/ui-store.ts`) — `addToast` para notificaciones.
- TanStack Query — `useQueryClient().invalidateQueries({ queryKey: ['customers'] })` tras crear/editar/eliminar. Hook `useCustomers` en `frontend/hooks/useData.ts` usa la misma clave.
- `PermissionGuard` (`frontend/components/auth/permission-guard.tsx`) — evalúa permisos vía `usePermissions` (roles de `useAuthStore` + `ROLE_PERMISSIONS` de `frontend/types/permissions.ts`).

## Flujo de usuario

1. El usuario abre `/customers`; la página obtiene los clientes en el servidor y muestra métricas y directorio.
2. Pulsa `+ Nuevo cliente` (`NewCustomerButton`) y va a `/customers/new`.
3. En `CustomerForm` completa documento (con `DniSearch` opcional), datos personales, contacto y notas; al enviar valida y hace `POST /customers`.
4. Al éxito invalida `['customers']`, muestra toast y navega a `/customers`.
5. Desde una tarjeta entra a `/customers/[id]` para ver detalle, estadísticas e historial de compras.
6. Pulsa `Editar` y va a `/customers/[id]/edit`, donde `CustomerForm` precarga el cliente y hace `PATCH /customers/:id`.
7. Desde las acciones de la tarjeta puede eliminar mediante `DeleteDialog` (`DELETE /customers/:id`), si tiene permiso.

## Notas

- `CustomerModal` existe en `frontend/components/customers/`, pero no se encontró importado en las páginas listadas de `customers/` (no verificado en el código su uso efectivo dentro de esta área).
- `customer-form.tsx` valida `documentNumber` con el esquema zod, pero construye el `payload` enviando el campo como `documentValue`; el `payload` se envía a la API.
- `serverApiFetch` devuelve `null` ante error o ausencia de token; las páginas usan valores por defecto (por ejemplo `?? 0`, `?? []`).
- El listado en `/customers` calcula `Nuevos este mes` filtrando por `createdAt` en el cliente con la fecha local del navegador/servidor.
