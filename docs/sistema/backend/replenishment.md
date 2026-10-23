# Módulo: replenishment

## Propósito

Calcula sugerencias de reposición de inventario, días de cobertura por producto y promedios de
demanda/forecast a partir del histórico de ventas (`SaleItem`). Requiere el módulo de plan
`inventory`.

## Archivos clave

- `backend/src/modules/replenishment/replenishment.controller.ts` — rutas de sugerencias, cobertura y forecast.
- `backend/src/modules/replenishment/replenishment.service.ts` — lógica de sugerencias de pedido y días de cobertura.
- `backend/src/modules/replenishment/forecast.service.ts` — cálculo de demanda promedio y clasificación ABC.
- `backend/src/modules/replenishment/dto/replenishment.dto.ts` — DTOs `ForecastQueryDto` y `CoverageQueryDto`.
- `backend/src/modules/replenishment/replenishment.module.ts` — importa `PrismaModule`; exporta `ReplenishmentService` y `ForecastService`.

## Autorización a nivel de controlador

- `@Controller('replenishment')` → base real `/api/replenishment`.
- Guards de clase: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`.
- `@RequireModule('inventory')` a nivel de clase. No hay `@RequireFeature`.
- Guards globales (registrados en `AppModule`): `CsrfGuard` (mutaciones), `ThrottlerGuard`,
  `JwtAuthGuard`, `RolesGuard`, `PlanCapabilitiesGuard`.

## Endpoints

### GET /api/replenishment/suggestions
- **Descripción**: Lista productos activos con `reorderPoint` no nulo y stock por debajo del punto de
  reorden, con la cantidad sugerida a pedir y prioridad.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([replenishment:view])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de `{ productId, productName, sku, currentStock, reorderPoint, suggestedOrder, priority }`,
  ordenado por prioridad (`high` < `medium`).
- **Efectos secundarios**: solo lectura.
- **Errores**: ninguno explícito.

### GET /api/replenishment/coverage/:productId
- **Descripción**: Días de cobertura de stock de un producto según su demanda promedio diaria (ventana de 30 días).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([replenishment:view])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno.
- **Path params**: `productId`.
- **Query (DTO `CoverageQueryDto`)**: `days` (number, opcional, `@IsInt()`, `@IsPositive()`). Se valida pero **no se usa**: el servicio llama siempre con ventana de 30 días (`getCoverageDays` internamente usa 30).
- **Respuesta**: `{ productId, productName, currentStock, dailyAverage, coverageDays }` (`coverageDays` es `null` si `dailyAverage = 0`).
- **Efectos secundarios**: solo lectura.
- **Errores**: `Error('Product not found')` (no es una `HttpException` de Nest; se normaliza por el filtro global) si el producto no existe en la empresa.

### GET /api/replenishment/forecast
- **Descripción**: Demanda promedio por producto en una ventana de días y clasificación ABC por ingresos.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([forecast:view])`.
- **Plan**: `@RequireModule('inventory')`.
- **Guards extra**: ninguno.
- **Query (DTO `ForecastQueryDto`)**: `days` (number, opcional, `@IsInt()`, `@IsPositive()`). Se pasa como `query.days ?? 30`.
- **Respuesta**: array de `{ id, name, sku, stockQuantity, totalSold, revenue, dailyAverage, revenueShare, classification }`,
  ordenado por ingreso desc.
- **Efectos secundarios**: solo lectura.
- **Errores**: ninguno explícito.

## Funciones del servicio (`ReplenishmentService`)

### `getSuggestions(companyId)`
- **Qué hace**: obtiene productos activos con `reorderPoint` no nulo. Por cada uno con
  `stock < reorderPoint`, calcula la demanda diaria (`ForecastService.getDemandAverage(companyId, productId, 30)`;
  si es 0 usa `1`), el lead time (`leadTimeDays ?? 7`) y el stock de seguridad (`safetyStock` o
  `ceil(dailyAverage * 3)`). `suggestedOrder = ceil(dailyAverage * leadTime + safetyStock - stock)`
  (mínimo 0). Prioridad `high` si `stock <= safetyStock`, si no `medium`. Ordena por prioridad.
- **Escribe en**: nada.
- **Devuelve**: array de sugerencias.
- **Lanza**: nada.

### `getCoverageDays(companyId, productId)`
- **Qué hace**: valida que el producto exista en la empresa; obtiene la demanda promedio (ventana 30)
  y calcula `floor(stockQuantity / dailyAverage)` (o `null` si `dailyAverage = 0`).
- **Escribe en**: nada.
- **Devuelve**: `{ productId, productName, currentStock, dailyAverage, coverageDays }`.
- **Lanza**: `Error('Product not found')` si el producto no existe.

## Funciones del servicio (`ForecastService`)

### `getDemandAverage(companyId, productId, days = 30)`
- **Qué hace**: suma las cantidades de `saleItem` del producto vendidas desde `hoy - days` y calcula el promedio diario.
- **Escribe en**: nada.
- **Devuelve**: `{ productId, days, totalSold, dailyAverage }` (`dailyAverage` redondeado a 2 decimales).
- **Lanza**: nada.

### `getDemandAverages(companyId, days = 30)`
- **Qué hace**: agrega ventas por producto en la ventana (`totalSold`, `revenue`, `revenueShare`) y
  calcula la clasificación ABC acumulada: `A` si la cuota acumulada `<= 80`, `B` si `<= 95`, si no `C`.
  Ordena por ingreso desc.
- **Escribe en**: nada.
- **Devuelve**: array de `{ id, name, sku, stockQuantity, totalSold, revenue, dailyAverage, revenueShare, classification }`.
- **Lanza**: nada.

## No verificado en el código

- El DTO `CoverageQueryDto` se inyecta en el controller pero se ignora (el parámetro se llama `_query`);
  `getCoverageDays` fija la ventana en 30 días. Por eso el query `days` de cobertura no tiene efecto.
- `getCoverageDays` y el `coverage/:productId` no `throw`ean `NotFoundException` de Nest sino un `Error` genérico.
- `getSuggestions` no pagina; devuelve todos los productos bajo el punto de reorden.
