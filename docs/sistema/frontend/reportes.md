# Área: Reportes y analytics

Área de inteligencia de negocio del dashboard. Muestra el resumen agregado de
ventas (`/reports/overview`) con filtros por canal de venta y rango de fechas.
Ruta del código: `frontend/app/(dashboard)/reports/` y
`frontend/components/reports/reports-client.tsx`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/reports` | `frontend/app/(dashboard)/reports/page.tsx` | server (async component) | Obtiene la sesión y el resumen inicial con `serverApiFetch<ReportOverview>('/reports/overview', accessToken)` y renderiza `ReportsClient`. |

El componente `ReportsPage` es `async` y construye un objeto `initial` por
defecto (`totalSales: 0`, `totalRevenue: 0`, `totalCustomers: 0`,
`averageTicket: 0`, `revenueChange: 0`, arrays vacíos y `filters` con `null`)
cuando `serverApiFetch` devuelve `null` (por ejemplo, sin `accessToken`).

## Componentes

- `frontend/components/reports/reports-client.tsx` — componente cliente
  (`'use client'`) que recibe `initial: ReportOverview` y gestiona la UI de
  reportes. Responsabilidades:
  - Estado local de filtros: `channel` (`'' | 'POS' | 'ONLINE' | 'DISTRIBUTOR'`),
    `startDate`, `endDate`, y de carga (`loading`).
  - `load()`: arma un `URLSearchParams` con los filtros activos y llama a
    `apiFetch<ReportOverview>('/reports/overview?...', { token: getAccessToken() })`.
  - `useEffect` con `firstRender` (ref) para no recargar en el primer render;
    recarga al cambiar `channel`, `startDate` o `endDate`.
  - `clearFilters()` para limpiar los tres filtros.
  - Presenta: KPIs (ventas totales, ingresos, clientes únicos, ticket promedio),
    barras de "Ventas por canal" (con `CHANNEL_META`), variación de ingresos
    (`salesByDay`) y ranking de "Más vendidos" (`topProducts`).
  - Manejo de errores vía `useUiStore((state) => state.addToast)` con mensaje
    `'Error al cargar reportes'` si falla la petición.

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `app/(dashboard)/reports/page.tsx` | `GET /reports/overview` | `serverApiFetch<ReportOverview>` (`frontend/lib/server-api.ts`) | Server-side; usa `session.accessToken`; `cache: 'no-store'`; devuelve `null` si no hay token o falla. |
| `ReportsClient` (filtros) | `GET /reports/overview?channel=&startDate=&endDate=` | `apiFetch<ReportOverview>` (`frontend/lib/api.ts`) con `token: getAccessToken()` | Se dispara al cambiar filtros (no en el primer render). Reintenta con `POST /auth/refresh` ante 401 automáticamente desde `apiFetch`. |

## Estado global

- No hay stores Zustand propios de reportes.
- `frontend/store/ui-store.ts` — `useUiStore`, usado para `addToast` (errores de
  carga).
- Cliente HTTP: `frontend/lib/api.ts` (`apiFetch`, `getAccessToken`) en el
  cliente y `frontend/lib/server-api.ts` (`serverApiFetch`) en el servidor.
- La sesión se lee con `getServerSession` (`frontend/lib/session.ts`), de la que
  se toma `accessToken`.

## Flujo de usuario

1. El usuario navega a `/reports`.
2. El servidor obtiene la sesión y el resumen de ventas (`/reports/overview`) y
   lo pasa como `initial` a `ReportsClient`.
3. El usuario ve los KPIs, la distribución por canal, la tendencia de ingresos y
   los productos más vendidos.
4. El usuario cambia el canal, la fecha "Desde" o "Hasta"; `ReportsClient` vuelve
   a llamar al endpoint con esos parámetros y actualiza la vista.
5. El usuario puede pulsar "Limpiar" para restablecer los filtros (botón
   deshabilitado si no hay filtros activos).
6. Si la petición falla, se muestra un toast de error.

## Notas

- El canal se etiqueta en la UI como `POS` = "Tienda", `ONLINE` = "Online",
  `DISTRIBUTOR` = "Distribuidor".
- Las fechas se envían como `startDate`/`endDate` en formato del input `date`
  (no se transforman en el cliente).
- No se ha verificado en el código ninguna función de exportación de reportes
  desde esta área.
