# Módulo: low-stock

## Propósito

Evalúa si un producto quedó con stock bajo respecto a su mínimo y despacha notificaciones `LOW_STOCK`
a los responsables de la empresa. También corre un barrido diario programado (`@Cron`) sobre todos
los productos con stock bajo.

## Archivos clave

- `backend/src/modules/low-stock/low-stock.service.ts` — lógica de notificación `notifyIfLowStock`, barrido programado `scanLowStock` y helpers.
- `backend/src/modules/low-stock/low-stock.service.spec.ts` — pruebas de comportamiento esperado de ambos métodos.
- `backend/src/modules/low-stock/low-stock.module.ts` — importa `PrismaModule` y `NotificationsModule`; exporta `LowStockService`.

## Controlador

No tiene controller. `LowStockService` se expone solo como proveedor y es consumido por otros módulos
(p. ej. `sales`, `distributors`, `inventory`) vía `notifyIfLowStock`. Por lo tanto no hay endpoints
HTTP en este módulo.

## Barrido programado (`@Cron`)

### `scanLowStock()`
- **Decorador**: `@Cron(CronExpression.EVERY_DAY_AT_7AM)` — se ejecuta todos los días a las 07:00.
- **Qué hace**: busca en `products` los que cumplen `isActive = true`, `deletedAt = null` y
  `stockQuantity <= minStock` (el `where` usa `stockQuantity: { lte: this.prisma.product.fields.minStock }`,
  es decir comparación columna-contra-columna). Por cada producto llama a `notifyIfLowStock` con
  `force: true`. Cuenta cuántas notificaciones se enviaron realmente y lo registra en el log.
- **Destinatarios de la notificación**: los `memberships` activos (`isActive = true`) de la empresa cuyo
  `role` sea `COMPANY_ADMIN` o `MANAGER` (`LOW_STOCK_RECIPIENT_ROLES`). Se desduplican por `userId`.
- **Deduplicación**: un destinatario no recibe una nueva alerta para el mismo producto si ya tiene una
  notificación `LOW_STOCK` sin leer (`isRead = false`) con `data.productId = productId`.
- **Escribe en**: `notifications` (una fila por destinatario que no tenga alerta pendiente).
- **Devuelve**: `number` (cantidad de destinatarios notificados en el barrido).
- **Errores**: captura cualquier error, lo registra con `logger.error` y devuelve `0` (no propaga).

## Funciones del servicio (`LowStockService`)

### `notifyIfLowStock(input)`
- **Qué hace**: recibe `{ companyId, productId, productName?, currentStock, minStock, baseUnit?, previousStock?, previousMinStock?, force? }`.
  Normaliza `currentStock`/`minStock` a número; si alguno es `null`, devuelve `false`. Si
  `currentStock > minStock`, devuelve `false`. Si no es `force`, solo notifica cuando el producto cruzó
  el umbral: si `previousStock` no es `null` y `previousStock <= previousMinStock`, devuelve `false`
  (evita repetir mientras ya estaba por debajo). Si corresponde, despacha.
- **Escribe en**: `notifications` (a través de `NotificationsService.create`), una por destinatario objetivo.
- **Devuelve**: `Promise<boolean>` (`true` si despachó al menos una notificación).
- **Lanza**: nada explícito.
- **Nota**: el `dispatch` interno arma el mensaje `El producto "<name>" tiene stock bajo: <n> <unidad> disponible(s) (mínimo <m> <unidad>).`
  El nombre por defecto es `'Producto'` y la unidad se toma de `UNIT_LABELS`
  (`UNIT`→`unidades`, `KG`→`kg`, `LT`→`litros`, `MT`→`metros`; por defecto `unidades`).

### Detalles de `dispatch` (privado)
- **Destinatarios**: `getRecipients(companyId)` obtiene `memberships` activos con rol `COMPANY_ADMIN` o
  `MANAGER`; si no hay, devuelve `false` sin notificar.
- **Exclusión de pendientes**: `getPendingRecipients` consulta `notifications` con `type = 'LOW_STOCK'`,
  `isRead = false`, `userId IN destinatarios` y `data.productId = productId` (ruta JSON `['productId']`);
  los destinatarios con alerta pendiente se excluyen. Si no quedan objetivos, devuelve `false`.
- **Payload de la notificación**: `type = 'LOW_STOCK'`, `title = 'Stock bajo'`, `message` construido,
  `data = { productId, stockQuantity: currentStock, minStock }`. `NotificationsService.create` usa
  `channel = IN_APP` por defecto.

## Comportamiento esperado (según `low-stock.service.spec.ts`)

- Notifica a `COMPANY_ADMIN` y `MANAGER` cuando el stock cae por debajo del mínimo.
- Deduplica destinatarios que ya tienen una alerta pendiente sin leer.
- No envía nada si el stock está por encima del mínimo.
- No repite mientras el producto ya estaba por debajo del mínimo previo.
- Sí notifica cuando el mínimo se eleva por encima del stock actual.
- `force: true` notifica aunque el producto ya estuviera por debajo (usado por el barrido).
- Devuelve `false` si la empresa no tiene miembros `COMPANY_ADMIN`/`MANAGER`.
- Es tolerante a valores nulos (stock, umbral, nombre y unidad).
- `scanLowStock` alerta por cada producto activo en o por debajo de su mínimo y falla de forma segura
  (devuelve `0`) ante un error de base de datos.

## No verificado en el código

- El spec instancia `LowStockService` con un `prisma` mockeado que incluye `product.fields.minStock`/
  `stockQuantity`; no se verificó el SQL exacto que Prisma genera para la comparación columna-contra-columna.
- No hay endpoint para forzar manualmente el barrido ni para consultar las alertas desde este módulo
  (las notificaciones se gestionan en el módulo `notifications`).
