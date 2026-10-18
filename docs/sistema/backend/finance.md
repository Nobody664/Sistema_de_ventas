# Módulo: finance

## Propósito
Control financiero de la empresa. Fusiona dos fuentes en una sola vista:
1. **Registros manuales** (`finance_records`): entradas (compras a proveedores) y salidas (sueldos, luz, agua, mantenimiento, otros).
2. **Ventas**: los `Sale` en estado `COMPLETED` se exponen como filas **sintéticas** de salida con `category = 'SALE'`, solo lectura.

La semántica es literal: `balance = entradas − salidas`, donde las **ventas cuentan como salida** (y también se agregan por separado como "Ventas") y los demás egresos como "Gastos". El acceso es exclusivo de `COMPANY_ADMIN` y **no** está sujeto a módulos/features de plan.

## Archivos clave
- `backend/src/modules/finance/finance.controller.ts` — controller `finance` con guards de clase `JwtAuthGuard`, `TenantGuard`, `PermissionsGuard` y `@Roles('COMPANY_ADMIN')`.
- `backend/src/modules/finance/finance.service.ts` — `FinanceService`; fusión de registros manuales + ventas, resumen y CRUD con auditoría.
- `backend/src/modules/finance/dto/finance.dto.ts` — `CreateFinanceRecordDto`, `UpdateFinanceRecordDto`, `QueryFinanceRecordDto` + constantes `FINANCE_DIRECTIONS` y `FINANCE_CATEGORIES`.
- `backend/src/modules/finance/finance.module.ts` — importa `PrismaModule`; `AuditService` proviene de `AuditCommonModule` (`@Global`).
- Registrado en `backend/src/app.module.ts`.

## Permisos
Nuevos permisos en `backend/src/common/constants/permissions.constant.ts`:

| Permiso | Descripción | Roles |
|---------|-------------|-------|
| `finance:list` | Ver registros y resumen | `COMPANY_ADMIN` (y `SUPER_ADMIN` por comodín) |
| `finance:manage` | Crear/editar/eliminar registros manuales | `COMPANY_ADMIN` (y `SUPER_ADMIN`) |

## Modelo
Tabla `finance_records` (modelo `FinanceRecord`, migración `20261016000000_add_expiry_alerts_finance`):

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | `String` | cuid |
| `companyId` | `String` | `@@index([companyId, recordDate])` |
| `direction` | `FinanceDirection` | `ENTRY` \| `EXIT`; `@@index([companyId, direction])` |
| `category` | `FinanceCategory` | `PURCHASE` \| `SALE` \| `PAYROLL` \| `ELECTRICITY` \| `WATER` \| `MAINTENANCE` \| `OTHER`; `@@index([companyId, category])` |
| `description` | `String` | obligatorio (255) |
| `amount` | `Decimal(12,2)` | `>= 0` |
| `currency` | `String` | default `PEN` |
| `recordDate` | `DateTime` | fecha del movimiento |
| `dueDate` | `DateTime?` | vencimiento opcional (sin uso en cálculos) |
| `reference` | `String?` | boleta/factura/recibo |
| `supplier` | `String?` | proveedor (entradas) |
| `employeeId` | `String?` | `@@index([employeeId])`; relación `Employee.financeRecords` |
| `notes` | `String?` | |
| `createdById` | `String?` | |

## Endpoints

Prefijo global `/api`. Los 6 endpoints exigen JWT + tenant y rol `COMPANY_ADMIN`.

### GET /api/finance
- **Descripción**: lista fusionada y paginada de registros manuales y ventas.
- **Query** (`QueryFinanceRecordDto`): `from`, `to` (ISO 8601; se normalizan a inicio/fin de día), `direction`, `category`, `search` (descripción/referencia/proveedor en manuales; `saleNumber` en ventas), `page` (default 1), `limit` (default 20, máx 100).
- **Comportamiento**: consulta manuales y ventas en paralelo, las ordena por `recordDate desc` y pagina sobre el conjunto fusionado. `take = min(skip + limit, 500)` por origen (tope `MAX_MERGED_ROWS = 500`). Las ventas se incluyen solo si no se filtró por `direction = 'ENTRY'` ni por una `category` distinta de `SALE`.
- **Respuesta**: `{ items: FinanceRecordView[], total, page, limit }`; `total = manualCount + saleCount`.
- **`FinanceRecordView`**: `{ id, source: 'MANUAL' | 'SALE', direction, category, description, amount: number, currency, recordDate, dueDate, reference, supplier, notes, employeeId, employeeName, editable, createdAt }`. Las ventas llegan con `source: 'SALE'`, `editable: false`, `description = "Venta <saleNumber>"`.

### GET /api/finance/summary
- **Descripción**: agregados del periodo para tarjetas y totales semanales.
- **Query**: mismos filtros de rango (`from`/`to`); por defecto últimos **30 días**.
- **Respuesta** (`FinanceSummary`): `from`, `to`, `entries { total, count }`, `exits { total, count }`, `sales { total, count }`, `expenses { total, count }`, `balance = entries − exits`, `byCategory`, y `weeks[]` con `{ start, end, entries, exits, sales, expenses, balance }`. Las semanas van de **lunes a domingo** (`weekStartOf`) y se ordenan ascendentemente.
- **Nota**: las ventas suman a `exits`, `sales` y `byCategory.SALE`; los egresos manuales alimentan `expenses` (toda salida con categoría distinta de `SALE`).

### GET /api/finance/:id
- **Descripción**: un registro manual de la empresa.
- **Errores**: 404 `Registro financiero no encontrado.`

### POST /api/finance
- **Body** (`CreateFinanceRecordDto`): `direction` (requerido), `category` (opcional), `description` (3–255), `amount` (`>= 0`, máx 2 decimales), `recordDate` (ISO), `dueDate`, `reference`, `supplier`, `employeeId`, `notes`.
- **Reglas de categoría** (`resolveCategory`):
  - `SALE` manual → 400 `Las ventas se registran automaticamente desde el modulo de Ventas.`
  - `ENTRY` con categoría de gasto (`PAYROLL`/`ELECTRICITY`/`WATER`/`MAINTENANCE`/`OTHER`) → 400 `La categoria seleccionada no aplica para entradas.`
  - `EXIT` con `PURCHASE` → 400 `Las compras se registran como entradas.`
  - Sin categoría: `ENTRY → PURCHASE`, `EXIT → OTHER`.
- **Efectos secundarios**: auditoría `AuditAction.CREATE` sobre `FinanceRecord`; valida que `employeeId` pertenezca a la empresa (400 `El empleado indicado no existe.`).

### PATCH /api/finance/:id
- **Body** (`UpdateFinanceRecordDto`): todos opcionales; `null` explícito limpia `dueDate`, `reference`, `supplier`, `notes` y desconecta `employeeId`.
- **Efectos secundarios**: auditoría `AuditAction.UPDATE` con `before`/`after`.
- **Errores**: 404; 400 por reglas de categoría o empleado inexistente.

### DELETE /api/finance/:id
- **Descripción**: elimina un registro **manual** (no aplica a ventas sintéticas).
- **Efectos secundarios**: auditoría `AuditAction.DELETE`.
- **Errores**: 404.

## Servicio (notas)
- `resolveRange(query, defaultDays?)` — convierte `from`/`to` a `startOfDay`/`endOfDay`; si no hay rango y se pasa `defaultDays`, usa los últimos N días (30 en el resumen).
- `mapManual` / `mapSale` — proyectan a `FinanceRecordView` normalizando `Decimal → number` y fechas a ISO.
- `employeeName` se compone de `firstName + lastName`.

## Notas de seguridad / operación
- No hay endpoints públicos: los 6 exigen JWT.
- No hay gating por plan: es una herramienta interna de administración.
- Las ventas nunca se crean, editan ni borran desde este módulo; la única fuente de verdad de las ventas sigue siendo `sales`.
