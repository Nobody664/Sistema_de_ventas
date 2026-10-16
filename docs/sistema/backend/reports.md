# Módulo: reports

## Propósito
Expone el resumen agregado de ventas de una empresa (totales, ticket promedio, variación de ingresos, productos top, tendencia diaria y desglose por canal). Es de solo lectura y consulta datos de `sales`, `sale_items`, `products` y `customers`.

## Archivos clave
- `backend/src/modules/reports/reports.controller.ts` — controller de `reports`; define `GET /api/reports/overview` y aplica gating de módulo/feature y permiso.
- `backend/src/modules/reports/reports.service.ts` — `ReportsService.getSalesOverview`; construye las agregaciones y cachea el resultado.
- `backend/src/modules/reports/dto/reports-query.dto.ts` — `ReportsOverviewQueryDto` (filtros de entrada).
- `backend/src/modules/reports/reports.module.ts` — declara controller y service; importa `PrismaModule` y exporta `ReportsService`.

## Endpoints

### GET /api/reports/overview
- **Descripción**: Devuelve un resumen de ventas de la empresa (`tenantId` del JWT) con filtros opcionales por canal y rango de fechas.
- **Auth**: JWT (guard global) + `@Permissions([Permission.REPORT_SALES])` (`report:sales`).
- **Plan**: `@RequireModule('reports')` y `@RequireFeature('reports.basic')` (ambos a nivel de clase en el controller).
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)` a nivel de clase. `PlanCapabilitiesGuard` es global (registrado como `APP_GUARD`).
- **Path params**: ninguno.
- **Query (DTO `ReportsOverviewQueryDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `channel` | `'POS' \| 'DISTRIBUTOR' \| 'ONLINE'` | No | `@IsOptional()`, `@IsIn(['POS','DISTRIBUTOR','ONLINE'])` | Filtra ventas por canal. |
  | `startDate` | `string` | No | `@IsOptional()`, `@IsDateString()` | Fecha inicial (se usa como `gte` sobre `createdAt`). |
  | `endDate` | `string` | No | `@IsOptional()`, `@IsDateString()` | Fecha final; el servicio fija `23:59:59.999` del día (se usa como `lte`). |

- **Body**: ninguno.
- **Respuesta** (objeto `SalesOverview`):
  - `totalSales: number` — cantidad de ventas que cumplen el filtro.
  - `totalRevenue: number` — suma de `Sales.totalAmount` con el filtro.
  - `totalCustomers: number` — total de clientes de la empresa (sin filtro de fecha).
  - `averageTicket: number` — `totalRevenue / totalSales` (0 si no hay ventas).
  - `revenueChange: number` — variación porcentual del ingreso del mes actual vs. mes anterior (0 si el mes anterior es 0).
  - `topProducts: Array<{ productId, name, quantity, revenue }>` — hasta 8 productos por cantidad vendida.
  - `salesByDay: Array<{ date, sales, revenue }>` — últimos 7 días (etiqueta `es-PE`, p. ej. `"lun 3"`).
  - `byChannel: Array<{ channel, sales, revenue }>` — ordenado por ingreso descendente.
  - `filters: { channel: string | null, startDate: string | null, endDate: string | null }`.
- **Efectos secundarios**: solo lectura; escribe únicamente en caché (`CacheService.set`). No escribe tablas de negocio, no genera notificaciones ni auditoría.
- **Errores**:
  - **400** si un query param no cumple el DTO (`ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`).
  - **403** por gating de plan (`MODULE_NOT_ENABLED` / `FEATURE_NOT_AVAILABLE`).
  - **403** por falta de permiso `report:sales` (`PermissionsGuard`).
  - **403** de `TenantGuard` (sin `companyId`, o empresa `SUSPENDED`/`INACTIVE`/`PAST_DUE`).

## Funciones del servicio (`ReportsService`)

### `getSalesOverview(companyId: string, query: ReportsOverviewQueryDto = {}): Promise<SalesOverview>`
- **Qué hace**: Construye el `where` con `companyId`, canal y rango de fechas; consulta en paralelo `sale.count`, `sale.aggregate` (total, mes actual, mes anterior), `customer.count`, `saleItem.groupBy` (top productos), `sale.findMany` (últimas 1000 ventas para la tendencia) y `sale.groupBy` por canal. Obtiene nombres de productos (`product.findMany`) y arma la tendencia de los últimos 7 días respecto de `endDate` (o `now`). Guarda el resultado en caché.
- **Lee de**: `sales`, `sale_items`, `products`, `customers`.
- **Escribe en**: caché con clave `reports:sales-overview:<companyId>:<channel|all>:<startDate>:<endDate>` y TTL de **30 segundos** (`CacheService`). No escribe en base de datos.
- **Devuelve**: `Promise<SalesOverview>` (ver estructura en la respuesta del endpoint). Si hay valor cacheado, lo retorna sin consultar la base.
- **Lanza**: no lanza excepciones propias; propaga errores de Prisma/caché.

## Notas
- El módulo solo importa `PrismaModule`; `CacheService` se resuelve por el `CacheModule` global (importado en `AppModule`).
- No hay endpoint de exportación ni de reportes financieros en este módulo (no verificado en el código).
