# Refix backend — Fase 3: B-09 a B-12

## Rama y alcance

Implementación en `refix/backend-fase-3`, desde el checkpoint documentado de Fase 2. Los cambios se guardan antes de continuar con `refix/backend-fase-4`.

## B-09 — Inventario y distribuidores

- Los ajustes de salida condicionan la escritura a stock suficiente; dos peticiones con una lectura antigua no pueden dejar un saldo negativo.
- Los ajustes positivos y devoluciones físicas crean disponibilidad de lotes; las salidas reservan lotes dentro de su transacción.
- Una presentación de ajuste debe corresponder al producto y a la empresa.
- `DistributorStock` registra cantidades base por distribuidor/producto. Vender o devolver un SKU no puede consumir el saldo de otro SKU.
- Transferencias acreditan el detalle; ventas y devoluciones lo debitan con una condición de cantidad suficiente. El saldo agregado también se modifica condicionalmente.
- Las liquidaciones decrementan la deuda condicionalmente y crean su registro financiero en la misma transacción, evitando el patrón de sobrescribir un saldo leído previamente.
- Se conservan las reglas anteriores de deuda por consignación: reportar una venta no vuelve a generar deuda. La política de créditos monetarios por mercadería devuelta no se redefine silenciosamente en esta fase.

### Datos anteriores

La migración no inventa un desglose por SKU a partir de un total. Distribuidores con saldo disponible previo quedan con `stockReconciled = false`. Antes de operar, un administrador/gerente con permiso de transferencia debe utilizar:

`POST /api/distributors/:id/reconcile-stock`

El cuerpo contiene `reason` y `items: [{ productId, quantity }]`. Se valida pertenencia a la empresa, ausencia de duplicados y coincidencia de la suma con el saldo agregado. La conciliación inicial es transaccional y auditada; no permite cambiar deuda o crear cantidades fuera del saldo existente.

## B-10 — Reversión completa de ventas

- Lectura, reclamación de estado, devolución física, saldo del distribuidor, nota de crédito y auditoría forman una transacción SERIALIZABLE.
- Repetir la misma reversión no devuelve stock ni acredita dinero dos veces.
- POS/online devuelve al almacén central y a lotes. El canal distribuidor devuelve al detalle y saldo del distribuidor, sin incrementar indebidamente el almacén central.
- Se utiliza `SaleItem.baseQuantity` histórico. Si una presentación antigua no tiene snapshot, se rechaza la reversión hasta conciliarla, en lugar de usar un factor mutable actual.
- Las nuevas ventas POS guardan el costo de salida que devuelve kardex. Para una venta histórica sin ese costo se conserva la valoración de costo de producto disponible; esto no reconstruye trazabilidad de lotes históricos inexistente.
- Las notas descuentan el descuento original, prorratean impuestos en notas parciales y limitan lo acreditable al importe realmente pagado menos notas activas anteriores.
- Una reversión completa acredita solo el remanente. Su `operationKey` es único y una nota ligada a esa reversión no se puede cancelar aisladamente.
- Si la emisión de la nota falla, se revierte también la devolución. No se captura el error dejando un reembolso incompleto.
- El cambio de estado de una nota es condicional a su estado leído, evitando resucitar una cancelada por una actualización concurrente.

## B-11 — Ciclo contratado de upgrades

- La solicitud persiste `billingCycle`, además del importe capturado.
- La aprobación utiliza ese ciclo y el helper de vigencia UTC, no el ciclo actual del catálogo.
- El pago confirmado completa `paidAt`.
- Reutilizar una solicitud pendiente con otras condiciones genera conflicto.
- Para solicitudes históricas sin ciclo se exige `legacyBillingCycle` y una justificación en `reviewNotes`. No se adivina un año/mes a partir de precios que podrían haber cambiado.
- Se validan los valores de ciclo, decisión y fecha. Un importe histórico inválido necesita conciliación.
- Se adelantó la corrección del pipe de IDs del circuito de upgrade: los CUID ya no se rechazan como UUID inválidos. Solo se aceptan identificadores opacos acotados, no sintaxis de rutas/query.

## B-12 — Proyección pública de administradores

Promoción, revocación y ramas sin cambios usan un `select` público. No devuelven hashes de contraseña ni campos internos añadidos al modelo User. No se relajaron los permisos administrativos para obtener esa proyección.

## Migración y compatibilidad

`20261102000000_inventory_refund_upgrade_integrity` añade stock por SKU, indicador de conciliación, costo histórico, ciclo de solicitud y clave única de reversión. Incluye restricción de cantidad no negativa en el detalle de distribuidor.

No se aplicó a la base compartida durante el desarrollo. Los snapshots y ciclos desconocidos siguen siendo explícitamente desconocidos; requieren conciliación cuando se intenta la operación correspondiente.

## Verificación

- Generación de Prisma, lint y build aprobados.
- Suite completa: **244 pruebas, 73 suites, 0 fallos**.
- Pruebas nuevas: salida concurrente con lectura antigua, SKU inexistente aunque haya saldo agregado, necesidad de conciliación, unidades históricas frente a factor cambiado, nota por importe neto pagado, rollback al fallar la nota, canal distribuidor, prorrateo, ciclo anual y respuestas sin secretos.
- Los ensayos de concurrencia de dominio usan repositorios simulados. Las pruebas de carga y concurrencia con PostgreSQL real y la revisión de datos históricos se deben completar en el entorno de integración.

La fase conserva los cambios de Fases 1/2 y normaliza con Prettier los archivos heredados que aún estaban sin formato. La siguiente fase cubre B-13 a B-16.
