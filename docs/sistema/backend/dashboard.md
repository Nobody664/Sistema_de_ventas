# Módulo: dashboard

## Propósito
Provee métricas agregadas: un panel global para administradores de plataforma (`SUPER_ADMIN`/`SUPPORT_ADMIN`) y un panel por empresa (tenant) con ventas del día, analítica, inventario y clientes. Es de solo lectura y usa caché.

## Archivos clave
- `backend/src/modules/dashboard/dashboard.controller.ts` — controller de `dashboard`; define `GET /api/dashboard/global` y `GET /api/dashboard/tenant`.
- `backend/src/modules/dashboard/dashboard.service.ts` — `DashboardService.getGlobalMetrics` y `getTenantMetrics`.
- `backend/src/modules/dashboard/dashboard.module.ts` — declara controller y service; importa `PrismaModule` y exporta `DashboardService`.

## Endpoints

### GET /api/dashboard/global
- **Descripción**: Métricas globales de la plataforma (empresas y facturación recurrente).
- **Auth**: JWT (guard global) + `@Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')`.
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Path params / Query / Body**: ninguno.
- **Respuesta** (objeto `GlobalMetrics`):
  - `totalCompanies: number`, `activeCompanies: number` (status `ACTIVE`), `suspendedCompanies: number` (status `SUSPENDED`).
  - `monthlyRecurringRevenue: number` — suma de `plan.priceMonthly` de suscripciones `ACTIVE`.
  - `annualRecurringRevenue: number` — suma de `plan.priceYearly` de suscripciones `ACTIVE`.
  - `collectedRevenue: number` — suma de `payment.amount` de pagos `SUCCEEDED`.
- **Efectos secundarios**: solo lectura; escribe en caché (`dashboard:global`, TTL **120 s**).
- **Errores**:
  - **403** si el usuario no tiene rol `SUPER_ADMIN` ni `SUPPORT_ADMIN` (`RolesGuard`).

### GET /api/dashboard/tenant
- **Descripción**: Métricas de la empresa del usuario (`tenantId` del JWT).
- **Auth**: JWT (guard global).
- **Plan**: ninguno.
- **Guards extra**: `@UseGuards(JwtAuthGuard, TenantGuard)`.
- **Path params / Query / Body**: ninguno.
- **Respuesta** (`TenantMetrics`, o `null` si `companyId` viene vacío):
  - `company: { name, status, currency } | null` y `companyId: string`.
  - Conteos: `totalProducts`, `totalCustomers`, `totalEmployees`.
  - Ventas de hoy: `salesToday` (cantidad) y `revenueToday`.
  - `lowStockProducts: number` (productos con `stockQuantity <= minStock`).
  - `topProducts: Array<{ productId, name, quantity }>` — hasta 5, calculados sobre las últimas 25 ventas con sus ítems.
  - `salesAnalytics: { daily[7], weekly (siempre `[]`), monthly, averageTicket, totalSales, totalRevenue }` — `daily`/`monthly` derivados de las últimas 500 ventas de 30 días; `averageTicket = totalRevenue / totalSales`.
  - `paymentMethods: Array<{ method, count, total }>` — de las últimas 500 ventas, ordenado por total descendente.
  - `inventoryMetrics: { totalValue, totalItems, lowStockCount, outOfStockCount, slowMovingCount }` — calculados sobre hasta 10000 productos; `totalValue = Σ salePrice * stockQuantity`; `slowMovingCount` = productos con `stockQuantity > 50`.
  - `customerStats: { total, newThisMonth, topCustomers[5] }` — top clientes por gasto (nombre = `firstName + lastName`).
- **Efectos secundarios**: solo lectura; escribe en caché (`dashboard:tenant:<companyId>`, TTL **60 s**).
- **Errores**:
  - **403** de `TenantGuard` (sin `companyId`, o empresa `SUSPENDED`/`INACTIVE`/`PAST_DUE`).

## Funciones del servicio (`DashboardService`)

### `getGlobalMetrics(): Promise<GlobalMetrics>`
- **Qué hace**: Cuenta empresas por estado, carga suscripciones `ACTIVE` con su plan y pagos `SUCCEEDED`, y calcula MRR/ARR e ingreso cobrado.
- **Lee de**: `companies`, `subscriptions`, `plans`, `payments`.
- **Escribe en**: caché `dashboard:global` (TTL 120 s).
- **Devuelve**: `Promise<GlobalMetrics>`.
- **Lanza**: no lanza excepciones propias; propaga errores de Prisma.

### `getTenantMetrics(companyId: string)`
- **Qué hace**: Si `companyId` es falsy devuelve `null`. Consulta en paralelo ventas de hoy, últimas 25 ventas con ítems/productos, datos de la empresa, conteos, ventas de los últimos 30 días (hasta 500), productos (hasta 10000) y clientes nuevos del mes; deriva analítica, top productos, métodos de pago, top clientes y métricas de inventario.
- **Lee de**: `sales`, `sale_items`, `products`, `companies`, `customers`, `employees`.
- **Escribe en**: caché `dashboard:tenant:<companyId>` (TTL 60 s).
- **Devuelve**: objeto `TenantMetrics`, o `null` si `companyId` es vacío.
- **Lanza**: no lanza excepciones propias; propaga errores de Prisma.

## Notas
- `salesAnalytics.weekly` se devuelve siempre como arreglo vacío (no se calcula en el código).
- El controller no usa `@RequireModule`/`@RequireFeature`; el endpoint `tenant` depende solo del `TenantGuard`.
