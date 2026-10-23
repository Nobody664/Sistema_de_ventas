# Módulo: kardex

## Propósito

Expone el kardex valorizado de inventario (`InventoryKardex`): consulta de asientos, resumen de
saldos por producto y reporte de rentabilidad. Además, `KardexService` es el componente que asienta
entradas y salidas valorizadas cuando otros módulos (ventas, inventario, distribuidores) registran
movimientos de stock. El método de costeo se toma de `Company.inventoryCostMethod` y se resuelve con
las estrategias FIFO o WEIGHTED_AVERAGE.

## Archivos clave

- `backend/src/modules/kardex/kardex.controller.ts` — rutas de consulta del kardex y rentabilidad.
- `backend/src/modules/kardex/kardex.service.ts` — asiento de movimientos (IN/OUT), consulta, resumen y rentabilidad.
- `backend/src/modules/kardex/dto/kardex.dto.ts` — DTO de filtros de consulta (`QueryKardexDto`).
- `backend/src/modules/kardex/strategies/costing.strategy.ts` — interfaz `CostingStrategy` y tipo `CostingResult`.
- `backend/src/modules/kardex/strategies/fifo.strategy.ts` — estrategia FIFO.
- `backend/src/modules/kardex/strategies/weighted-average.strategy.ts` — estrategia de costo promedio ponderado.
- `backend/src/modules/kardex/kardex.module.ts` — importa `PrismaModule`; exporta `KardexService`.

## Autorización a nivel de controlador

- `@Controller('kardex')` → base real `/api/kardex`.
- Guards de clase: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`.
- `@RequireModule('inventory')` y `@RequireFeature('inventory.kardex')` a nivel de clase → gating
  `MODULE_NOT_ENABLED` / `FEATURE_NOT_AVAILABLE` (403) si el plan no los incluye.
- Guards globales (registrados en `AppModule`): `CsrfGuard` (mutaciones), `ThrottlerGuard`,
  `JwtAuthGuard`, `RolesGuard`, `PlanCapabilitiesGuard`.

## Endpoints

### GET /api/kardex
- **Descripción**: Lista asientos de kardex de la empresa con filtros opcionales.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([kardex:view])`.
- **Plan**: `@RequireModule('inventory')` + `@RequireFeature('inventory.kardex')`.
- **Guards extra**: ninguno.
- **Query (DTO `QueryKardexDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `productId` | string | No | `@IsString()` | Filtra por producto |
  | `startDate` | string (date) | No | `@IsDateString()` | Filtra `movementDate >= startDate` |
  | `endDate` | string (date) | No | `@IsDateString()` | Filtra `movementDate <= endDate` |
  | `movementType` | string | No | `@IsString()` | Filtra por tipo de asiento (`IN`/`OUT`) |

- **Respuesta**: array de `InventoryKardex` con `product {name, sku}`, ordenado por `movementDate` desc. Sin paginación.
- **Efectos secundarios**: solo lectura.
- **Errores**: no hay `throw` explícito en el servicio para esta ruta.

### GET /api/kardex/products/:id
- **Descripción**: Asientos de kardex de un producto. Llama internamente a `query(tenantId, { productId: id })`.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([kardex:view])`.
- **Plan**: `@RequireModule('inventory')` + `@RequireFeature('inventory.kardex')`.
- **Guards extra**: ninguno.
- **Path params**: `id` (productId).
- **Respuesta**: igual que `GET /api/kardex` filtrado por producto.
- **Efectos secundarios**: solo lectura.
- **Errores**: no valida que el producto exista; devuelve `[]` si no hay asientos.

### GET /api/kardex/summary
- **Descripción**: Saldo más reciente por producto (agrupado por `productId`) con el valor total del inventario.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([kardex:view])`.
- **Plan**: `@RequireModule('inventory')` + `@RequireFeature('inventory.kardex')`.
- **Guards extra**: ninguno.
- **Query/Body**: ninguno.
- **Respuesta**: `{ entries: [{ productId, productName, productSku, balanceQty, balanceUnitCost, balanceTotalCost }], totalValue }`.
- **Efectos secundarios**: solo lectura.
- **Errores**: no hay `throw` explícito.

### GET /api/kardex/profitability
- **Descripción**: Reporte de rentabilidad por producto (ingresos de ventas vs. costo de salida del kardex) con margen.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([report:financial])`.
- **Plan**: `@RequireModule('inventory')` + `@RequireFeature('inventory.kardex')`.
- **Guards extra**: ninguno.
- **Query**: `startDate` (string, opcional), `endDate` (string, opcional). No están declarados en un DTO con validación (llegan como `@Query('startDate')` / `@Query('endDate')` crudos).
- **Respuesta**: array de `{ productId, productName, productSku, category, revenue, cost, grossProfit, margin }`.
- **Efectos secundarios**: solo lectura.
- **Errores**: no hay `throw` explícito.

## Funciones del servicio (`KardexService`)

### `getStrategy(companyId)` (privado)
- **Qué hace**: lee `Company.inventoryCostMethod` y devuelve la estrategia registrada (`FIFO` o `WEIGHTED_AVERAGE`).
- **Escribe en**: nada.
- **Devuelve**: `CostingStrategy`.
- **Lanza**: `NotFoundException('Company not found')` si la empresa no existe; `Error('Unknown costing strategy: ...')` si el método no tiene estrategia.

### `recordInMovement(companyId, productId, quantity, unitCost, movementId, tx)`
- **Qué hace**: asienta una entrada. Busca el último asiento por `movementDate` desc, calcula
  `totalCostIn = unitCost * quantity`, el nuevo saldo (`balanceQty`, `balanceTotalCost`) y el
  `balanceUnitCost` promedio; crea el asiento `IN`.
- **Escribe en**: `inventory_kardex` (fila `IN`).
- **Devuelve**: `void`.
- **Lanza**: nada explícito (usa el `tx` recibido).

### `recordOutMovement(companyId, productId, quantity, movementId, tx)`
- **Qué hace**: si el producto no tiene ningún asiento de kardex, inicializa uno de apertura a partir
  del stock actual (`openingQuantity = stockQuantity + quantity`) y `product.costPrice`. Luego resuelve
  la estrategia de costeo de la empresa, calcula `unitCost`/`totalCost` de la salida, recalcula saldos
  y crea el asiento `OUT`.
- **Escribe en**: `inventory_kardex` (posible fila `IN` de apertura y fila `OUT`).
- **Devuelve**: `{ unitCost, totalCost }` (`Prisma.Decimal`).
- **Lanza**: `Error('Product ${productId} not found while initializing kardex.')` si no encuentra el producto al inicializar; los errores que lance la estrategia (`FIFO`/`WEIGHTED_AVERAGE`).

### `query(companyId, filters)`
- **Qué hace**: construye el `where` con `productId`, `movementType` y rango de `movementDate` según `filters`.
- **Escribe en**: nada.
- **Devuelve**: array de `InventoryKardex` con `product {name, sku}`, orden `movementDate` desc.
- **Lanza**: nada.

### `getSummary(companyId)`
- **Qué hace**: agrupa `inventory_kardex` por `productId` tomando el máximo de `balanceQty`,
  `balanceUnitCost` y `balanceTotalCost`; descarta los que tienen `balanceQty` nulo o `<= 0`; enlaza
  nombre/sku del producto y suma el valor total.
- **Escribe en**: nada.
- **Devuelve**: `{ entries, totalValue }`.
- **Lanza**: nada.

### `getProfitability(companyId, startDate?, endDate?)`
- **Qué hace**: toma los asientos `OUT` del rango; obtiene los `saleItem` de esos productos y de la
  empresa; calcula ingresos por producto (suma de `totalPrice`, filtrando por `sale.createdAt` dentro
  del rango) y costo por producto (suma de `totalCostOut`); calcula `grossProfit = revenue - cost` y
  `margin = grossProfit / revenue * 100` (2 decimales, 0 si `revenue = 0`); agrega el nombre de la
  categoría.
- **Escribe en**: nada.
- **Devuelve**: array de `{ productId, productName, productSku, category, revenue, cost, grossProfit, margin }`.
- **Lanza**: nada.
- **Nota**: los productos considerados son los que aparecen en asientos `OUT` del rango; un producto
  sin salidas de kardex en el rango no aparece en el reporte.

## Estrategias de costeo

### FIFO (`FifoStrategy`)
- **`calculateOutCost(productId, quantity, companyId, tx)`**: lee todos los asientos del producto
  ordenados por `movementDate` asc y reconstruye "capas" de inventario: cada asiento `IN` con
  `unitCostIn` añade una capa `{ qty, unitCost }`; cada asiento `OUT` consume capas en orden FIFO.
  Con las capas restantes consume `quantity` de la más antigua a la más nueva para hallar el costo.
- **Devuelve**: `{ unitCost: totalCost/quantity, totalCost }`.
- **Lanza**: `Error('Insufficient inventory layers for product ${productId}...')` si las capas no alcanzan.

### WEIGHTED_AVERAGE (`WeightedAverageStrategy`)
- **`calculateOutCost(productId, quantity, companyId, tx)`**: toma el último asiento por
  `movementDate` desc y usa su `balanceUnitCost` como costo unitario.
- **Devuelve**: `{ unitCost: lastEntry.balanceUnitCost, totalCost: unitCost * quantity }`.
- **Lanza**: `Error('No inventory balance found for product ${productId}')` si no hay asiento o `balanceQty <= 0`.

Interfaz común (`costing.strategy.ts`): `{ name: string; calculateOutCost(...): Promise<CostingResult> }`
con `CostingResult = { unitCost: Prisma.Decimal; totalCost: Prisma.Decimal }`. El `tx` es un
`PrismaClient` sin `$on/$connect/$disconnect/$transaction/$use/$extends`.

## No verificado en el código

- `GET /api/kardex/profitability` usa `report:financial` (no `kardex:export`); el permiso `kardex:export`
  existe en el enum pero ningún endpoint de este módulo lo exige.
- `GET /api/kardex`/`products/:id`/`summary`/`profitability` no declaran paginación.
- `recordInMovement` y `recordOutMovement` ordenan por `movementDate` desc sin desempate explícito; con
  fechas iguales el orden no queda determinado por el código.
- No se inspeccionaron aquí los llamadores externos (`inventory`, `sales`, `distributors`) más allá de
  que invocan `recordInMovement`/`recordOutMovement`.
