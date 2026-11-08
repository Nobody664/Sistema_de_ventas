# Corrección: confirmación de pedidos, carrito y avisos al negocio

## Rama

`fix/tienda-confirmacion-carrito-pago`, creada desde `main` en `5a389e0`.

## Diagnóstico

Los logs de Render del 8 de noviembre de 2026 muestran errores de `POST /api/store/:slug/orders`: la transacción interactiva vencía a los 10 segundos, con ejecuciones de 10 352 y 10 492 ms. Prisma revertía la operación completa, incluyendo pedido, reservas, carrito y notificaciones.

La reserva hacía múltiples consultas y escrituras por producto y por lote. Además:

- Los avisos al dueño se insertaban directamente y no se publicaban por SSE.
- Solo el cliente tenía correo comercial encolado.
- El error de confirmación se mostraba lejos de la cotización.
- La clave se generaba con `crypto.randomUUID()` antes del bloque de manejo de errores: un fallo en esa llamada podía dejar el botón en estado de espera.
- El carrito del encabezado no se refrescaba explícitamente al confirmar.

## Cambios

### Registro atómico y reservas

- Presupuesto de 30 segundos exclusivamente para la transacción de creación de pedido; se mantiene el aislamiento serializable y los reintentos existentes.
- Bloqueos ordenados y consultas agrupadas para productos/lotes, altas de reservas y asignaciones en bloque, actualizaciones parametrizadas de cantidades reservadas.
- La cantidad de viajes de reserva no crece por producto: 9 consultas/escrituras para los casos probados de 2 y 50 productos con lotes existentes; una escritura adicional agrupada cuando hace falta crear lotes de apertura.
- Los productos vencidos, sin existencias o con lotes insuficientes siguen rechazándose.
- Pedido, reserva, limpieza del carrito, historial, auditoría, avisos y correos encolados se confirman o revierten juntos.
- Una misma cotización recupera su pedido existente incluso si el cliente pierde la respuesta y vuelve con otra clave. Reutilizar una clave para otra cotización continúa siendo un conflicto.

### Avisos al dueño

- El aviso se conserva en la base de datos y su publicación se registra en el outbox dentro de la misma transacción.
- El procesador publica por SSE después del commit; vuelve a comprobar que el destinatario sea un dueño activo de la compañía.
- Los reintentos del outbox no crean otra notificación. El frontend mantiene su deduplicación de eventos.
- Se encolan correos cifrados para dueño y cliente en `StoreMail`. El transporte externo no bloquea la creación del pedido.
- El outbox se procesa cada 10 segundos y la cola de correo cada 30 segundos, con los mecanismos de lease y reintento existentes.

### Confirmación visible y recuperación

- Botón explícito, bloqueo sincrónico contra doble clic y mensaje de progreso.
- Errores junto al botón, recuperación sin perder el carrito si la operación se revierte y enlace al pedido registrado si la navegación tarda.
- Clave estable durante los reintentos y alternativa mediante `getRandomValues` cuando no existe `randomUUID`.
- Tiempo HTTP acotado; la confirmación dispone de 120 segundos para cubrir espera/transacción/reintentos, sin reenvíos automáticos del POST por timeout.
- Se actualiza el carrito desde el servidor después del registro y se navega al detalle del pedido.

## Flujo esperado

1. Agregar productos y seleccionar entrega, dirección con cobertura y pago habilitado por la compañía.
2. Calcular el total con datos y precios del servidor.
3. Confirmar una sola vez: mostrar progreso, registrar el pedido y reservar existencias.
4. Vaciar el carrito del pedido confirmado y abrir su detalle.
5. Mostrar el pedido al negocio, publicar su aviso y procesar los correos encolados.
6. Completar el pago según el método: comprobante/revisión, efectivo al retirar o pasarela. Confirmar un pedido no equivale a registrar un cobro.

## Verificación

- **19 pruebas backend aprobadas**: integración Prisma/PostgreSQL/HTTP, reserva agrupada, outbox y notificaciones.
- La integración introduce una demora de **11 segundos** en la reserva y el pedido se registra correctamente.
- Un fallo provocado después de crear historial/avisos/correos revierte todo; se comprueba que no quedan pedidos ni reservas y el carrito se conserva.
- Reintentar con la misma clave y con otra clave para la misma cotización devuelve el mismo pedido.
- Se comprueban el carrito vacío, una sola notificación persistida, publicación SSE una sola vez por procesamiento y correos para dueño/cliente.
- **106 pruebas frontend aprobadas**, incluyendo claves sin `randomUUID` y timeout sin duplicar el POST.
- **Smoke de tienda aprobado**: primer intento simulado devuelve error visible, conserva cantidades; segundo intento usa la misma clave, registra pedido y deja el contador en cero; continúa comprobante, atención administrativa y entrega.
- Lint y builds de frontend/backend aprobados.

Las pruebas usan fixtures y PostgreSQL embebido: verifican el encolado y el procesamiento interno, no la entrega real en la bandeja de correo. La corrección debe integrarse y desplegarse para aplicarse a producción.
