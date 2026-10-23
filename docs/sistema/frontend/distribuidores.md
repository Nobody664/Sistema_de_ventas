# Área: Distribuidores

Documenta el área de distribuidores del frontend Next.js (App Router). Código en
`frontend/app/(dashboard)/distributors/`, `frontend/components/distributors/` y
`frontend/types/distributors.ts`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/distributors` | `frontend/app/(dashboard)/distributors/page.tsx` | server | Lista distribuidores (`GET /distributors`), métricas de stock en consigna y deuda total, tarjetas con enlace a detalle. |
| `/distributors/new` | `frontend/app/(dashboard)/distributors/new/page.tsx` | server | Verifica sesión, redirige a `/sign-in` si no hay usuario y renderiza `DistributorForm` (creación). |
| `/distributors/[id]` | `frontend/app/(dashboard)/distributors/[id]/page.tsx` | server | Detalle del distribuidor: datos, balance, `DistributorOperations`, ventas y despachos. Llama `notFound()` si no existe. |
| `/distributors/[id]/edit` | `frontend/app/(dashboard)/distributors/[id]/edit/page.tsx` | server | Carga el distribuidor y renderiza `DistributorForm` (edición); redirige a `/distributors` si no existe. |

## Componentes

- `frontend/components/distributors/distributor-form.tsx` — formulario cliente de creación/edición (código, nombre, tipo, documento, estado en edición, comisión, contacto, dirección y notas). Hace `POST /distributors` o `PATCH /distributors/:id`.
- `frontend/components/distributors/distributor-actions.tsx` — exporta `DistributorActions` (enlaces a edición con `PermissionGuard permission="distributor:update"` y `DeleteDialog entity="distributor"` con `distributor:delete`; ajusta la descripción si hay stock/deuda) y `NewDistributorButton` (enlace a `/distributors/new` con `distributor:create`).
- `frontend/components/distributors/distributor-operations.tsx` — panel cliente con pestañas Stock (transferir/devolver), Venta, Liquidación y Despacho; ejecuta las operaciones contra el backend y hace `router.refresh()`.
- `frontend/types/distributors.ts` — tipos `Distributor`, `DistributorBalance`, `DistributorSale`, `DistributorDelivery`, `DistributorProductOption`, `DistributorType`, `DistributorStatus`.

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `/distributors` (página) | `GET /distributors` | `serverApiFetch` | Server component; usa `accessToken` de `getServerSession`. |
| `/distributors/[id]` (página) | `GET /distributors/:id` | `serverApiFetch` | Datos y `balance` del distribuidor. |
| `/distributors/[id]` (página) | `GET /products` | `serverApiFetch` | Opciones de producto (`DistributorProductOption[]`). |
| `/distributors/[id]` (página) | `GET /distributors/:id/sales` | `serverApiFetch` | Ventas registradas. |
| `/distributors/[id]` (página) | `GET /distributors/:id/deliveries` | `serverApiFetch` | Despachos registrados. |
| `/distributors/[id]/edit` (página) | `GET /distributors/:id` | `serverApiFetch` | Precarga del formulario. |
| `DistributorForm` | `POST /distributors` / `PATCH /distributors/:id` | `apiFetch` | Body con `code`, `name`, `type`, `documentType`, `documentValue`, `email`, `phone`, `address`, `notes`, `commissionRate`; en edición añade `status`. |
| `DistributorActions` (DeleteDialog) | `DELETE /distributors/:id` | `apiFetch` | `frontend/components/common/delete-dialog.tsx`; invalida `['distributors']`. |
| `DistributorOperations` (Stock) | `POST /distributors/:id/transfers` | `apiFetch` | `{ items: [{ productId, quantity }], notes }`. |
| `DistributorOperations` (Stock) | `POST /distributors/:id/returns` | `apiFetch` | `{ items: [{ productId, quantity }], notes }`. |
| `DistributorOperations` (Venta) | `POST /distributors/:id/sales` | `apiFetch` | `{ items: [{ productId, quantity, unitPrice }], paymentMethod }`. |
| `DistributorOperations` (Liquidación) | `POST /distributors/:id/settlements` | `apiFetch` | `{ amount, notes }`; botón deshabilitado si `debt <= 0`. |
| `DistributorOperations` (Despacho) | `POST /distributors/:id/deliveries` | `apiFetch` | `{ items: [{ productId, quantity }], status, notes }`. |
| Toda página protegida | `GET /auth/me` | `getServerSession` (`frontend/lib/session.ts`) | Lee la cookie `access_token`. |

## Estado global

- `useUiStore` (`frontend/store/ui-store.ts`) — `addToast` en formulario y operaciones.
- `PermissionGuard` (`frontend/components/auth/permission-guard.tsx`) — permisos `distributor:update`, `distributor:delete`, `distributor:create`.
- Estado local con `useState` en `DistributorForm`/`DistributorOperations`; `router.refresh()` tras crear/editar y tras cada operación.
- No se detectó store Zustand específico de distribuidores ni hooks de TanStack Query dedicados para esta área.

## Flujo de usuario

1. El usuario abre `/distributors`; la página lista distribuidores y calcula stock consignado total y deuda total a partir de `balance`.
2. Pulsa `+ Nuevo distribuidor` y va a `/distributors/new`; `DistributorForm` valida `code` y `name` y hace `POST /distributors`.
3. Al éxito navega a `/distributors` y refresca.
4. Desde una tarjeta entra a `/distributors/[id]` para ver datos, balance (consignado, vendido, devuelto, stock actual), deuda y listados de ventas/despachos.
5. En `DistributorOperations` puede: transferir o devolver stock, registrar una venta (con método de pago), registrar una liquidación (si hay deuda) o un despacho con estado.
6. Cada operación muestra toast, hace `router.refresh()` y recarga los datos del servidor.
7. Pulsa `Editar` para ir a `/distributors/[id]/edit` y hacer `PATCH /distributors/:id`; o elimina mediante `DeleteDialog` (`DELETE /distributors/:id`) si tiene permiso.

## Notas

- El alta reutiliza `POST /distributors`; en creación `DistributorForm` no envía `status`, mientras que en edición incluye `status` (`ACTIVE`/`SUSPENDED`/`BLOCKED`).
- `DistributorActions` ajusta el texto del `DeleteDialog` cuando hay `balanceQuantity > 0` o `debtAmount > 0`, pero la protección real de borrado la determina el backend (no verificado en el código de frontend).
- `DistributorOperations` asume al menos un producto (`products[0]?.id ?? ''`); si la lista viene vacía, los selectores quedan sin opciones.
- Los tipos del área viven en `frontend/types/distributors.ts` (no en `frontend/types/api.ts`).
- `serverApiFetch` devuelve `null` ante error o ausencia de token; la página de detalle usa `?? []` para los listados.
