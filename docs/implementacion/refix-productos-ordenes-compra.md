# Refix de productos y órdenes de compra

Subrama: `refix/productos-ordenes-compra`, creada desde `main` (`a22376f`).

## Productos: filtro por categoría

La consulta original devolvía la relación `category`, pero no `categoryId`, aunque la interfaz comparaba ese campo. Además, filtraba en memoria únicamente los primeros 50 productos.

- La proyección de productos vuelve a incluir `categoryId`.
- `GET /products/catalog` devuelve un catálogo paginado con `data`, `total`, `page`, `limit` y `totalPages`.
- Categoría, búsqueda y estado activo se aplican en Prisma antes de paginar, conservando el filtro por empresa y excluyendo productos eliminados.
- La búsqueda combina nombre, SKU, código de barras y descripción. La categoría y la búsqueda se pueden combinar.
- El endpoint existente `GET /products` conserva su respuesta en arreglo para los demás selectores.
- El frontend consulta el catálogo al cambiar filtros, vuelve a la primera página y distingue carga, errores y resultados realmente vacíos.
- El total corresponde al filtro completo; stock bajo y valor de venta se rotulan como datos de la página consultada.

## Órdenes de compra

### Creación manual

Nueva ruta: `/purchase-orders/new`, accesible desde el botón “Nueva orden de compra”.

- Selección de proveedor activo y productos activos del negocio mediante búsqueda paginada, sin depender de stock disponible ni del primer bloque del catálogo.
- Detalle de hasta 100 productos distintos, cantidades en unidades base y costos unitarios de hasta cuatro decimales.
- Referencia y notas opcionales. Los costos desconocidos se conservan como pendientes de cotización; un costo explícito cero no se confunde con un campo vacío.
- La creación y la auditoría se guardan en una transacción serializable. Se rechazan duplicados, valores fuera del rango del esquema y productos/proveedores ajenos o inactivos.
- Crear el borrador no escribe movimientos de inventario.

### Ciclo de vida

1. **Borrador:** se prepara el pedido.
2. **Enviada:** se registra que el operador compartió la orden con el proveedor. Esta acción no envía mensajes automáticamente.
3. **Recepción:** se confirman todas las cantidades solicitadas y los costos finales. El esquema actual admite recepción completa, no parcial.
4. **Confirmada/recibida:** la operación conserva la transacción existente que crea entrada, actualiza stock, registra kardex, costos y auditoría, y enlaza `stockEntryId`. Los reintentos idénticos no vuelven a ingresar mercadería.
5. **Cancelada:** finaliza una orden aún no recibida, sin aumentar inventario.

La interfaz adopta inmediatamente el estado devuelto por la API y actualiza las consultas de productos, inventario y órdenes. El detalle muestra cantidades recibidas, total recibido y entrada vinculada. Las órdenes históricas confirmadas sin entrada vinculada se identifican como pendientes de conciliación y no se reciben otra vez.

### Generación automática

Los borradores automáticos reutilizan la creación validada y auditada. Cada orden tiene hasta 100 líneas; grupos mayores se dividen en varias órdenes. Se conservan los costos unitarios conocidos y se indica “Por cotizar” si faltan costos. La atomicidad de creación corresponde a cada orden.

## Permisos y esquema

Las órdenes son operaciones de `COMPANY_ADMIN` y `MANAGER` con `supplier_order:manage` y contexto de empresa validado por el backend. El cajero no puede crearlas. La navegación de Super Admin sigue perteneciendo a plataforma.

Se reutilizan `SupplierOrder`, `SupplierOrderItem`, `StockEntry`, `receivedQuantity` y `stockEntryId`. No se modificó el esquema y no se requieren migraciones nuevas.

## Verificación

- Backend: lint, **327 pruebas aprobadas** y build correcto.
- Frontend: lint, **50 pruebas aprobadas** y build Webpack correcto, incluyendo la nueva ruta.
- `npm run test:browser:purchases`: cinco comprobaciones de catálogo, creación, envío/recepción, cancelación y restricciones de rol.
- `npm run test:browser:refix`: 16 comprobaciones previas aprobadas.
- La prueba de compras usa 60 productos sintéticos, comprueba filtrado posterior a los primeros 50, cantidades fraccionarias, costos aún no cotizados, stock sin cambios al crear/enviar y aumento único al recibir. También comprueba el stock recibido en el catálogo y el formulario a 390 px sin desbordamiento horizontal.
- Los servicios simulados y cuentas sintéticas no modifican registros de producción. La suite backend conserva los casos de recepción con el servicio real de entradas, concurrencia, rollback e idempotencia.

## Integración

Para publicar estos cambios debe estar disponible primero el backend con `/products/catalog`, y después el frontend que lo consume. La integración se divide en un commit backend y un commit frontend para permitir ese orden de despliegue manteniendo la compatibilidad del endpoint existente.
