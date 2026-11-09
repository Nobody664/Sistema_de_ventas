# Implementación de las fases 3 y 4

## Base y rama

- Commit previo: `d0e2a24` — `feat(tienda): crear centro administrativo`.
- Subrama: `arquitectura/03-04-operacion-gestion-tienda`, creada desde la entrega de las fases 1–2.

## Fase 3: operación de pedidos, pagos y entregas

- La entrada de cada función renderiza componentes administrativos dedicados en `frontend/features/store-admin/components/`. Ya no monta `StoreAdminOrders` ni sus formularios de integración dentro de las bandejas.
- Lista de tarjetas responsive con búsqueda, estado de pedido, pago, cola, retiro/delivery y paginación por cursor. Los filtros se conservan en la URL y al recargar.
- Tablero de colas derivadas: revisión, por preparar, en preparación, listos para retirar y en camino. Cada columna consulta su conteo completo y una muestra acotada, permite abrir la cola completa y tiene recuperación de errores propia. El tablero no ejecuta transiciones por movimiento visual.
- Detalle por ruta con totales del snapshot, cliente/entrega, seguimiento, historial, solicitud de devolución, comprobantes privados y acciones disponibles.
- El visor privado de comprobantes vive solo mientras está abierto; no almacena la imagen en Query ni añade persistencia local.
- Los comandos envían la versión y validan las referencias según la acción. Un 409 recarga el detalle y exige revisar el estado; un error de red no repite automáticamente un cobro o una devolución.
- Cancelar un pedido ahora valida la versión bajo bloqueo. El reembolso admite versión opcional para conservar consumidores legados; el frontend nuevo siempre la envía. La validación manual y el registro de intención de pasarela se realizan bajo bloqueo transaccional. La solicitud externa conserva la clave idempotente de la devolución existente.
- La devolución de dinero y el registro del retorno físico tienen acciones y mensajes distintos. El efectivo al retirar puede prepararse con reserva vigente, pero no ofrece entregar antes de confirmar el cobro.
- Las incidencias de pasarela se consultan por separado: su fallo no oculta los pedidos.
- Los avisos nuevos enlazan al pedido concreto. Al entrar en `CLOSEOUT`, tanto la ruta de servidor como el shell preservan el identificador al redirigir a atención histórica.
- Se reutiliza el store de notificaciones existente: nuevos avisos del comercio correcto y reconexiones invalidan detalle, bandejas, contexto y resumen. No se crea otra conexión SSE.

## Fase 4: catálogo, clientes y configuración

- `/comercio/catalogo`: galería/lista, búsqueda por nombre/SKU, categorías, filtros de publicación y actividad, vista del cliente y enlace al producto fuente. Publicar solo cambia `storeVisible`; no escribe precio ni stock ni activa productos.
- `/comercio/clientes` y `/comercio/clientes/:id`: cuentas paginadas/filtradas, contacto mínimo y pedidos recientes. No incluyen credenciales, documentos ni direcciones privadas innecesarias.
- La suspensión de una cuenta y la revocación de sus sesiones comerciales se guardan juntas en una transacción de esa compañía. No desactiva al usuario global ni sus cuentas en otros negocios.
- `/comercio/configuracion`: datos de la tienda; `/pagos`, `/entregas` y `/reglas`: formularios separados. Se muestran primero los métodos configurados, su estado y sus editores; después se ofrece agregar uno nuevo.
- Los métodos se ordenan por nombre e identificador en el mismo servicio que alimenta al checkout. No se agregó un orden manual sin soporte del modelo actual.
- Los formularios comparten los esquemas de validación existentes, muestran errores junto al campo, conservan datos ante fallo y bloquean envíos duplicados mientras guardan.
- Los secretos de integración no se recuperan para rellenar inputs y solo se limpian tras guardar correctamente.
- Delivery envía cobertura por ubigeo y omite dirección de retiro; retiro envía dirección y cobertura vacía. El backend normaliza también esos campos al cambiar el tipo de un método.
- Se conserva el incremento de versión comercial: editar métodos o reglas invalida cotizaciones previas, sin alterar snapshots de pedidos existentes.
- El guard de gestión resuelve contexto autorizado antes de leer o modificar catálogo/configuración, incluida la integración. El modo restringido conserva las rutas operativas existentes pero no habilita funciones de gestión por una llamada directa a la API.
- No se añadió un catálogo de ubigeos sin una fuente mantenida. Se conserva la validación de códigos de seis dígitos.

## Comprobaciones

- Suites completas de backend y frontend aprobadas; también compilación TypeScript y builds de producción de ambos proyectos.
- La integración HTTP con Prisma y PostgreSQL embebido verifica privacidad de cuentas, rechazo entre compañías, revocación comercial acotada, publicación sin modificar precio/stock, versión de cancelación/reembolso, aviso canónico, conservación de snapshots y rechazo de una cotización tras cambiar métodos.
- `npm run test:browser:commerce` usa Chromium, un backend de fixtures y EventSource controlado para comprobar: filtros/cursor, tablero sin escrituras, 409 sin reintento financiero automático, visor privado, cobro/preparación/retiro/entrega, despacho con seguimiento, devolución/retorno físico separados, nuevo pedido por aviso, recuperación al reconectar, catálogo, suspensión comercial y formularios con datos conservados al fallar.
- El mismo recorrido verifica rutas antiguas y profundas, empresas restringidas, roles rechazados y anchos 320/390/768/1440. Se corrigieron etiquetas de selectores y la pérdida del identificador del pedido durante la redirección restringida.

Las fases 5 y 6 mantienen su alcance futuro. El análisis de índices/EXPLAIN con datos representativos del despliegue, ya identificado en la fase 1, sigue pendiente y no se sustituye por mediciones de fixtures.
