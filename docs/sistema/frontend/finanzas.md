# Área: Finanzas

Control financiero de la empresa: entradas (compras a proveedores) y salidas (ventas, sueldos, luz,
agua, mantenimiento y otros gastos), con tarjetas de resumen, totales semanales y listado filtrable.
Exclusivo del rol `COMPANY_ADMIN`. Ruta del código: `frontend/app/(dashboard)/finance/` y
`frontend/components/finance/`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/finance` | `frontend/app/(dashboard)/finance/page.tsx` | server (`dynamic = 'force-dynamic'`) | Redirige a `/sign-in` sin sesión y a `/dashboard` si el rol no es `COMPANY_ADMIN`. Carga en paralelo `GET /finance`, `GET /finance/summary` y `GET /employees`. |
| `/finance` (UI) | `frontend/app/(dashboard)/finance/finance-client.tsx` | client (`FinancePageClient`) | Tarjetas, filtros, totales semanales y tabla de registros con acciones. |

Los filtros viven en la URL (`?from&to&direction&category&search&page`) y se aplican con
`router.push`, lo que re-ejecuta el server component (patrón de `discounts.md`).

## Interfaz

- **Encabezado**: tarjeta degradada `emerald → teal` con el botón "Nuevo registro" (`NewFinanceButton`).
- **Tarjetas de resumen**: Entradas, Salidas, Ventas y Gastos (`initialSummary`), cada una con su
  conteo de registros.
- **Balance del periodo**: `entries − exits` en verde/rojo según el signo, con el rango consultado.
- **Filtros**: `from`, `to`, `Tipo` (Todos/Entradas/Salidas), `Categoría` y `Buscar`; botones
  "Limpiar" y "Aplicar filtros".
- **Totales semanales**: tabla `Semana | Entradas | Salidas | Ventas | Gastos | Balance` a partir de
  `summary.weeks` (semanas de lunes a domingo).
- **Registros**: tabla `Fecha | Descripción | Categoría | Monto | Acciones`, con proveedor/empleado
  como subtítulo y el monto con signo (`+` entradas en verde, `−` salidas en rojo). Paginación
  Anterior/Siguiente sobre `page`/`total` del endpoint.

## Componentes

- `frontend/components/finance/finance-form.tsx` — `FinanceFormDialog` (cliente). `Dialog` que sirve
  para crear y editar:
  - Selector de tipo `ENTRY`/`EXIT` que reencuadra las categorías: entrada → `PURCHASE`/`OTHER`;
    salida → `PAYROLL`/`ELECTRICITY`/`WATER`/`MAINTENANCE`/`OTHER`.
  - Al elegir `PAYROLL` aparece el selector de empleado (opciones `{ id, name }` que entrega la
    página desde `GET /employees`).
  - Campos: descripción, monto (`S/`), referencia, fecha, vencimiento, proveedor y notas.
  - Valida con `createFinanceRecordSchema` (`frontend/lib/validations/finance.validation.ts`), envía
    `POST /finance` o `PATCH /finance/:id` con `apiFetch`, usa `handleLimitError`, `addToast`
    (`useUiStore`), invalida `['finance']` y llama `router.refresh()`.
- `frontend/components/finance/finance-actions.tsx` — `NewFinanceButton` (botón que abre el diálogo
  de creación) y `FinanceRowActions` (editar en diálogo + `DeleteDialog entity="finance"`); para
  registros de venta (`record.editable === false`) muestra la etiqueta "Automático".
- `frontend/components/common/delete-dialog.tsx` — soporta la entidad `finance`
  (`DELETE /finance/:id`, invalida `['finance']`).
- `frontend/components/layout/app-sidebar.tsx` — entrada del menú
  `{ label: 'Finanzas', href: '/finance', icon: Landmark, roles: ['COMPANY_ADMIN'] }` (sin `module`:
  no depende del plan).

## Validación

`frontend/lib/validations/finance.validation.ts` (`createFinanceRecordSchema`):

- `direction` en `['ENTRY', 'EXIT']`; `description` 3–255; `amount` numérico `> 0`; `recordDate`
  requerida.
- `category` obligatoria cuando `direction === 'EXIT'` (mensaje "Selecciona si es entrada o salida" /
  se muestra bajo el select).
- `employeeId` obligatorio cuando `category === 'PAYROLL'`.
- `dueDate` no puede ser anterior a `recordDate`.

## Tipos

En `frontend/types/api.ts`: `FinanceDirection`, `FinanceCategory`, `FinanceSource`,
`FinanceRecord`, `FinanceWeekBucket`, `FinanceSummary` y `FinanceListResponse`. Los montos llegan
como `number` (el backend ya convierte los `Decimal`).

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `/finance` (server) | `GET /finance?...` | `serverApiFetch<FinanceListResponse>` | Lista fusionada (manuales + ventas); `page`/`limit`. |
| `/finance` (server) | `GET /finance/summary?...` | `serverApiFetch<FinanceSummary>` | Agregados y semanas; por defecto 30 días sin rango. |
| `/finance` (server) | `GET /employees` | `serverApiFetch<EmployeeOptionResponse[]>` | Opciones del selector de empleado (sueldos). |
| `FinanceFormDialog` | `POST /finance` / `PATCH /finance/:id` | `apiFetch` | Crea o edita un registro manual; invalida `['finance']`. |
| `DeleteDialog` | `DELETE /finance/:id` | `apiFetch` | Registros manuales; las ventas no se pueden borrar desde aquí. |

## Permisos

`finance:list` y `finance:manage` existen en `frontend/types/permissions.ts` (`ROLE_PERMISSIONS`):
`SUPER_ADMIN` y `COMPANY_ADMIN` los tienen; el resto de roles no ve la entrada del menú ni puede
abrir la página (el guard de la página redirige a `/dashboard`).
