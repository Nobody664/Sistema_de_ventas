# Plan: Entradas desde proveedores / Salidas a distribuidores

## Objetivo
1. Las **entradas de stock** deben registrarse desde **proveedores** (quien te vende).  
2. Crear un nuevo módulo de **salidas a distribuidores** con lógica de **consignación** (ya existe en `DistributorsService.transfer()` y se integra con `DistributorBalance`).

## Estado actual
- `StockEntry` tiene `distributorId` (se usa hoy en entradas). Lo haremos **aditivo**: agregamos `supplierId` sin romper datos existentes.
- `DistributorsService.transfer()` ya descuenta stock, crea `InventoryMovement` (TRANSFER), actualiza `DistributorBalance` y reserva por lotes.
- Existe UI de "Entradas" en `/inventory/entries` (form usa campo "Distribuidor / Proveedor" hoy con lista de distribuidores).
- Existe UI de distribuidores con pestañas (Transferir/Devolver/Venta/Liquidación/Despacho).

## Decisiones tomadas
- `distributorId` se deja en `StockEntry` (aditivo). Se agrega `supplierId`.
- Salidas a distribuidores con **consignación** (usar lógica existente de `transfer`).
- UI nueva en sidebar: `/stock-exits` (independiente).

## Plan de implementación

### Fase 1: Backend - Modelo y migración
- [ ] `prisma/schema.prisma`: agregar `Supplier?` relación a `StockEntry` y `supplierId String? @map("supplier_id")`. Agregar `supplier Supplier? @relation(...)` en `Company`, `Supplier` (relación inversa), `StockEntry`.
- [ ] `prisma/schema.prisma`: `PurchaseReceipt` dejar `distributorId` por ahora (aditivo) o agregar `supplierId`. El plan pide entradas desde proveedores; podemos agregar `supplierId` aditivo también.
- [ ] Migración aditiva: `supplierId` nullable en `stock_entries` (y opcional en `purchase_receipts`).

### Fase 2: Backend - Permisos
- [ ] `backend/src/common/constants/permissions.constant.ts`: agregar `INVENTORY_OUTBOUND = "inventory:outbound"` (y agregarlo a roles relevantes: COMPANY_ADMIN, MANAGER).
- [ ] Si falta `DISTRIBUTOR_TRANSFER` ya existe; lo usaremos.

### Fase 3: Backend - StockEntries (entradas desde proveedores)
- [ ] `stock-entry.dto.ts`: agregar `supplierId?: string` a `CreateStockEntryDto`. En `CreatePurchaseReceiptDto` agregar `supplierId?: string` (aditivo).
- [ ] `stock-entries.service.ts`: en `create` validar `supplierId` (similar a distributorId), guardar `supplierId`. En `findAll/findById` incluir `supplier: { select: {...} }`. En `purchasesByDistributor` (ahora "por proveedor/distribuidor") agrupar por `supplierId` o mantener compatibilidad (priorizar `supplier` sobre `distributor`).
- [ ] `stock-entries.controller.ts`: sin cambios mayores.

### Fase 4: Backend - Módulo de salidas a distribuidores
- [ ] Crear módulo `stock-exits` (`backend/src/modules/stock-exits/`): `dto/stock-exit.dto.ts`, `stock-exits.service.ts`, `stock-exits.controller.ts`, `stock-exits.module.ts`, `stock-exits.service.spec.ts`.
- [ ] DTO: `CreateStockExitDto` con `distributorId`, `items[] { productId, quantity }`, `notes?`.
- [ ] Service: reutilizar lógica de `DistributorsService.transfer()` o llamar directamente. Debe:
  - Validar distribuidor activo
  - Validar stock suficiente
  - En transacción: decrementar `Product.stockQuantity`, reservar lotes (`ProductBatchesService.reserveFromBatch`), crear `InventoryMovement` tipo `TRANSFER` con `distributorId`, actualizar `DistributorBalance` (incrementar `startingQuantity`/`balanceQuantity` como hace `transfer`), registrar kardex `recordOutMovement`
  - Crear `AuditService.log` (entity `DistributorTransfer` o `StockExit`)
- [ ] Controller: `@Post()` con permisos `DISTRIBUTOR_TRANSFER` o `INVENTORY_OUTBOUND`, ruta `/stock-exits`
- [ ] Registrar módulo en `app.module.ts`

### Fase 5: Frontend - Entradas desde proveedores
- [ ] `app/(dashboard)/inventory/entries/entries-client.tsx`: cambiar label "Distribuidor / Proveedor" → "Proveedor". Cargar lista de **proveedores** (llamar `/suppliers`) en lugar de / o además de distribuidores. Enviar `supplierId` en lugar/además de `distributorId` según corresponda.
- [ ] `app/(dashboard)/inventory/entries/page.tsx`: traer `suppliers` desde API.
- [ ] Tipos: actualizar `StockEntryDistributorOption` o crear `StockEntrySupplierOption`.

### Fase 6: Frontend - Nuevo módulo salidas a distribuidores
- [ ] Crear `app/(dashboard)/stock-exits/page.tsx` (server) y `stock-exits-client.tsx` (client)
- [ ] Formulario: selector de distribuidor, selector de productos (stock disponible), cantidades, notas
- [ ] Historial: listar salidas recientes (puede leer desde `distributor.transfers` o endpoint propio)
- [ ] Agregar al sidebar: "Salidas a distribuidores" con ícono `ArrowUpFromLine` o `Truck`, rol COMPANY_ADMIN/MANAGER, hint "Consignación / transferencia"
- [ ] Permisos frontend: agregar `inventory:outbound` si aplica

### Fase 7: Verificación
- [ ] Backend: `npm run lint`, `npm test`, `npm run format`
- [ ] Frontend: `npm run lint`, `npm run format`
- [ ] Verificar flujo: entrada desde proveedor actualiza stock; salida a distribuidor descuenta stock y actualiza saldo

## Notas
- Mantener compatibilidad hacia atrás. No eliminar `distributorId` de `StockEntry`.
- Usar `DistributorsService.transfer()` si es posible para evitar duplicar lógica crítica (lotes, kardex, balance).
- Las boletas de compra (`PurchaseReceipt`) hoy se agrupan por distribuidor; con el cambio podemos agrupar por proveedor (mantener ambos).
