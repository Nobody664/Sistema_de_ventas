# Área: Inventario

Documenta el área de inventario del frontend Next.js (App Router). Código en
`frontend/app/(dashboard)/inventory/`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/inventory` | `frontend/app/(dashboard)/inventory/page.tsx` (+ `inventory-client.tsx`) | server + client | Panel resumen: valor de inventario, lotes por vencer y sugerencias; grilla de módulos con gating por plan. |
| `/inventory/branches` | `frontend/app/(dashboard)/inventory/branches/page.tsx` (+ `branches-client.tsx`) | server + client | Sucursales: alta (admin) y desactivación. |
| `/inventory/entries` | `frontend/app/(dashboard)/inventory/entries/page.tsx` (+ `entries-client.tsx`) | server + client | Registro de entradas de stock por unidad o presentación e historial. |
| `/inventory/batches` | `frontend/app/(dashboard)/inventory/batches/page.tsx` (+ `batches-client.tsx`) | server + client | Lotes por producto con control FEFO, filtro por producto y vista de por vencer. |
| `/inventory/kardex` | `frontend/app/(dashboard)/inventory/kardex/page.tsx` (+ `kardex-client.tsx`) | server + client | Kardex valorizado: movimientos, entradas/salidas y saldos. |
| `/inventory/replenishment` | `frontend/app/(dashboard)/inventory/replenishment/page.tsx` (+ `replenishment-client.tsx`) | server + client | Sugerencias de compra y pronóstico de demanda (clasificación ABC). |

## Componentes

- `frontend/app/(dashboard)/inventory/inventory-client.tsx` — grilla de módulos (`Kardex`, `Lotes`, `Entradas`, `Sucursales`, `Reposición`) con `usePlanCapabilities`/`canFeature` para bloquear `inventory.kardex` e `inventory.batches`; muestra alertas de lotes por vencer y reposición.
- `frontend/app/(dashboard)/inventory/branches/branches-client.tsx` — lista de sucursales, formulario de creación (solo `COMPANY_ADMIN`) y botón de desactivación.
- `frontend/app/(dashboard)/inventory/entries/entries-client.tsx` — formulario con líneas de producto/presentación, cantidad, costo unitario, cálculo de cantidad base (factor de presentación) e inversión total; tabla de historial de entradas.
- `frontend/app/(dashboard)/inventory/batches/batches-client.tsx` — tabla de lotes con estados Vigente/Por vencer/Vencido y filtro por producto; métricas de totales.
- `frontend/app/(dashboard)/inventory/kardex/kardex-client.tsx` — tabla de movimientos con filtros por producto y tipo, y métricas de valor/entradas/salidas.
- `frontend/app/(dashboard)/inventory/replenishment/replenishment-client.tsx` — pestañas Sugerencias y Pronóstico ABC, con métricas de prioridad alta y clasificación A.

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `/inventory` (página) | `GET /kardex/summary` | `serverApiFetch` | Devuelve `{ totalValue, entries }`. |
| `/inventory` (página) | `GET /product-batches/expiring?days=7` | `serverApiFetch` | Cuenta de lotes por vencer. |
| `/inventory` (página) | `GET /replenishment/suggestions` | `serverApiFetch` | Cuenta de sugerencias. |
| `/inventory/branches` (página) | `GET /branches` | `serverApiFetch` | Lista inicial de sucursales. |
| `BranchesPageClient` | `POST /branches` | `apiFetch` | Crea sucursal con `{ name, address }`. |
| `BranchesPageClient` | `PATCH /branches/:id` | `apiFetch` | Envía `{ isActive: !current }`; el botón invoca con `true` fijo (ver Notas). |
| `/inventory/entries` (página) | `GET /stock-entries` | `serverApiFetch` | Historial de entradas. |
| `/inventory/entries` (página) | `GET /products` | `serverApiFetch` | Opciones de producto con `presentations`. |
| `/inventory/entries` (página) | `GET /branches` | `serverApiFetch` | Opciones de sucursal (`{ id, name }`). |
| `StockEntriesClient` | `POST /stock-entries` | `apiFetch` | Body `{ branchId, reference, notes, items[] }`. |
| `/inventory/batches` (página) | `GET /product-batches` | `serverApiFetch` | Lista de lotes. |
| `/inventory/batches` (página) | `GET /products` | `serverApiFetch` | Mapa de nombres de producto. |
| `/inventory/batches` (página) | `GET /branches` | `serverApiFetch` | Mapa de nombres de sucursal. |
| `/inventory/batches` (página) | `GET /product-batches/expiring?days=7` | `serverApiFetch` | Vista "por vencer". |
| `/inventory/kardex` (página) | `GET /kardex` | `serverApiFetch` | Movimientos de kardex (`InventoryKardex[]`). |
| `/inventory/kardex` (página) | `GET /products` | `serverApiFetch` | Filtro por producto. |
| `/inventory/replenishment` (página) | `GET /replenishment/suggestions` | `serverApiFetch` | Sugerencias de compra. |
| `/inventory/replenishment` (página) | `GET /replenishment/forecast?days=30` | `serverApiFetch` | Pronóstico de demanda. |
| Toda página protegida | `GET /auth/me` | `getServerSession` (`frontend/lib/session.ts`) | Lee la cookie `access_token`. |

## Estado global

- `usePlanCapabilities` (`frontend/components/plan-capabilities/plan-capabilities-provider.tsx`) — `can`, `canFeature`; `inventory-client.tsx` bloquea módulos según `inventory.kardex` e `inventory.batches`.
- `useUiStore` (`frontend/store/ui-store.ts`) — `addToast` en entradas.
- `useAuthStore` (`frontend/stores/auth.store.ts`) — `user.roles` en `branches-client.tsx` para determinar `isAdmin` (`COMPANY_ADMIN`).
- Estado local con `useState` en los componentes cliente; `router.refresh()` tras mutaciones (`entries-client`, `branches-client` no usa refresh directo sino actualización de estado local).

## Flujo de usuario

1. El usuario abre `/inventory`; la página carga resumen, lotes por vencer y sugerencias en paralelo.
2. Selecciona un módulo. Si el plan no habilita `Kardex` o `Lotes`, el módulo se muestra bloqueado ("Mejora tu plan"); en caso contrario navega a la subruta.
3. En Sucursales, un `COMPANY_ADMIN` puede crear sucursales (`POST /branches`) y desactivar las existentes (`PATCH /branches/:id`).
4. En Entradas de stock, arma líneas (producto, presentación, cantidad, costo), ve la inversión total y registra con `POST /stock-entries`; el historial se refresca.
5. En Lotes, filtra por producto o conmuta la vista de "por vencer"; cada lote muestra estado según fecha de vencimiento.
6. En Kardex, filtra movimientos por producto y tipo, viendo entradas/salidas y saldos valorizados.
7. En Reposición, alterna entre sugerencias de compra y pronóstico ABC.

## Notas

- En `branches-client.tsx`, la desactivación llama `handleToggleActive(branch.id as string, true)`, es decir con `current = true` fijo independientemente del estado real de la sucursal; el resultado depende del backend. No se pudo verificar el estado real de `branch.isActive` más allá de que la lista solo muestra `isActive !== false`.
- El gating por plan se aplica en `inventory-client.tsx` a los módulos `Kardex` (`inventory.kardex`) y `Lotes` (`inventory.batches`); `Entradas`, `Sucursales` y `Reposición` no tienen `feature` asignada y no se bloquean.
- `entries-client.tsx` importa el tipo `StockEntryProductOption` desde `./page` (archivo de página server).
- Los filtros de lotes/kardex/reposición se aplican en el cliente sobre los datos cargados en el servidor; no se detectaron llamadas de filtrado al backend.
- `serverApiFetch` devuelve `null` ante error o ausencia de token; las páginas usan `?? []`.

## Actualizacion: fecha de ingreso y vencimiento por linea

- `entries-client.tsx` agrega el campo **Fecha** del ingreso (input `date`, valor por defecto hoy; se envia como ISO `T00:00:00`) y un campo **Vencimiento** por linea (`Line.expiryDate`).
- El historial usa `entry.entryDate ?? entry.createdAt` en la columna Fecha y muestra una columna **Vencimiento** por item (`-` si no tiene).
- Los tipos locales `EntryRecord`/`EntryItem` incorporan `entryDate` y `expiryDate`.

## Actualizacion: distribuidor/proveedor y boletas internas

- `page.tsx` carga ademas `GET /distributors` (`StockEntryDistributorOption[]`) y `GET /stock-entries/purchases/by-distributor` (`DistributorPurchaseSummary[]`) via `serverApiFetch` (con `?? []`).
- `entries-client.tsx` agrega el selector **Distribuidor / Proveedor** (opcion "General (sin distribuidor)") que se envia como `distributorId` en `POST /stock-entries`.
- El historial incorpora la columna **Distribuidor** (`entry.distributor?.name ?? 'General'`).
- Nueva tarjeta **Boletas internas** (compras por proveedor): una tarjeta por distribuidor/general con total comprado, numero de entradas y articulos, y boton **Imprimir boleta interna** que abre una ventana con el detalle y llama `print()` (helper `printReceipt` + `escapeHtml`).
