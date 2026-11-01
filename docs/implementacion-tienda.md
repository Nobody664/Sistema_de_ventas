# Implementación del portal comercial

## Ramas y entregas

| Rama | Fases | Estado |
| --- | --- | --- |
| `mejora/tienda-fases-1-3` | Identidad comercial, perfil/direcciones, publicación y catálogo | Implementado: lint de ambos proyectos y 3 pruebas de frontera aprobados |
| `mejora/tienda-fases-4-6` | Métodos, carrito/cotización, reservas | Implementado: lint, 6 pruebas comerciales y validación Prisma aprobados |
| `mejora/tienda-fases-7-10` | Pedidos/cobros, pasarela, entrega y validación | Implementado: 415 pruebas backend, 84 frontend, builds y navegador aprobados |

Las ramas se encadenan para conservar las dependencias. La integración a `main` y el push se realizan al terminar la tercera rama.

## Decisiones de implementación

- Credenciales `User` compartidas y cuenta comercial por empresa; ningún comprador crea una membresía laboral.
- Estrategia Passport comercial seleccionada explícitamente por el guard global, audiencia `store` y clave derivada distinta de la laboral.
- Cookies comerciales HttpOnly separadas; refresh rotativo con detección de reutilización.
- Verificación de correo, recuperación, datos personales y direcciones acotados a la cuenta; correo durable cifrado con arrendamiento y reintentos.
- Publicación explícita, desactivada por defecto; catálogo sin costos y proyecciones limitadas.
- El módulo `storefront` debe estar incluido en el plan de la empresa; la tienda además debe habilitarse desde el panel.

## Requisitos operativos

- SMTP operativo para entregar enlaces. Un correo no enviado nunca activa una cuenta.
- Mantener estables los secretos JWT: también protegen las sesiones y el contenido privado de la cola comercial mediante derivación de claves por propósito.
- Aplicar migraciones aditivas antes de iniciar esta versión y regenerar Prisma.

## Bloque 4–6

- Métodos de pago por empresa, entrega local por ubigeos, retiro, impuesto incluido/excluido y tarifa calculada por servidor.
- Carrito persistente con versión y una presentación por producto; cotización de cinco minutos con snapshots y validación de perfil.
- Reservas por producto/lote con cantidades base. Las restricciones de PostgreSQL impiden a cualquier salida (incluyendo POS, ajustes y distribuidores) reducir stock por debajo de lo reservado. El consumo normal de lotes utiliza solamente cantidades libres.
- La cotización no reserva. La creación/expiración de pedidos conecta el ciclo de vida de las reservas en el bloque siguiente.
- Pruebas ejecutadas sobre PGlite (motor PostgreSQL embebido): migraciones, relaciones entre empresas, competencia por unidades y restricciones de salida.

## Resultado funcional de las diez fases

| Fase | Resultado implementado |
| --- | --- |
| 1 | Cuenta comercial separada de Membership, tipo `USUARIO_CLIENTE_FINAL`, audiencia y firma separadas, cuotas independientes y tienda desactivada por defecto. |
| 2 | Registro por empresa, verificación de email, acceso, refresh rotativo, recuperación, perfil con DNI/teléfono, direcciones propias y suspensión comercial. |
| 3 | Publicación explícita de productos, catálogo privado, detalle, búsqueda, categorías, presentaciones y disponibilidad sin costos ni cantidades internas. |
| 4 | Métodos de pago por empresa, retiro/entrega por ubigeos, tarifas e impuestos incluidos/excluidos. |
| 5 | Carrito persistente con versión, cantidades/presentaciones validadas y cotización de cinco minutos calculada en servidor. |
| 6 | Reserva transaccional en producto/lotes aptos, protección de salidas multicanal y liberación/consumo idempotentes. |
| 7 | Pedido con snapshots y clave de idempotencia, comprobantes privados, revisión manual, cobro en retiro y publicación de una venta ONLINE. |
| 8 | Mercado Pago con comercio verificado por empresa, secretos cifrados, preferencia recuperable, webhook firmado, conciliación y devolución total. |
| 9 | Preparación, retiro/despacho/entrega, tracking textual, historial versionado, buzón comercial y correo durable; avisos internos a administradores. |
| 10 | Pruebas de integración HTTP con Prisma/PostgreSQL embebido, cadena completa de migraciones, pruebas de navegador, regresión y guía operativa. |

### Flujos disponibles

Cliente:

1. Abre `/tienda/<slug>/registro`, registra credenciales y acepta el tratamiento comercial de datos.
2. Verifica el enlace recibido por correo y entra desde `/tienda/<slug>/ingresar`.
3. Completa nombres, apellidos, DNI y teléfono en Perfil. Para entrega, registra una dirección con ubigeo.
4. Consulta catálogo/categorías/detalles y agrega productos al carrito.
5. Selecciona pago/entrega, calcula la cotización y confirma el total antes del vencimiento.
6. Completa pago manual, retiro en efectivo o checkout alojado, según la opción elegida.
7. Consulta Mis pedidos, estados, instrucciones, avisos y seguimiento; puede solicitar devolución.

Administrador de empresa:

1. Abre **Tienda virtual** (`/store`) y configura la publicación comercial.
2. Habilita métodos de pago y entrega, tarifas, impuestos y plazo de reserva.
3. Publica los productos seleccionados; no se publica todo el inventario automáticamente.
4. Atiende pedidos, revisa comprobantes privados y registra cobros con referencia real.
5. Prepara, marca retiro/despacho y registra entrega. Un retiro en efectivo no queda pagado al seleccionar el método.
6. Devuelve pagos completos y, por separado, registra el retorno físico cuando realmente recibió productos.
7. Suspende/reactiva cuentas comerciales verificadas sin desactivar al User global o sus cuentas en otras empresas.

`/atencion-tienda` permite a un administrador con sesión laboral válida atender operaciones existentes sin heredar el bloqueo comercial de nuevas compras. No habilita creación de pedidos ni configuración de una integración nueva en una empresa bloqueada. La recuperación de acceso laboral de una empresa suspendida sigue las reglas administrativas existentes.

## Arquitectura y consistencia

- Un `User` puede tener acceso laboral y cuentas comerciales. Las cookies `store_access_token`/`store_refresh_token` y la clave derivada de audiencia STORE no autentican endpoints laborales. El guard global selecciona la estrategia comercial solo mediante metadatos de rutas.
- La estrategia comprueba sesión, versión de credenciales, usuario activo, cuenta, empresa de la ruta y ficha comercial no eliminada. Los roles del payload no se utilizan para elevar permisos.
- Los compradores no crean Membership ni consumen licencias laborales. La tienda tiene capacidad propia (10.000 cuentas por defecto); los contadores de contactos manuales excluyen fichas vinculadas a cuentas comerciales.
- El registro con email global existente requiere conocer la contraseña y verificar el correo de la cuenta comercial; no reemplaza credenciales existentes. La vinculación de ficha por email se activa solo tras verificación; conflictos de documento/historial distintos requieren intervención del negocio.
- El snapshot JSON validado del pedido conserva líneas, factores, nombres, precios aceptados, datos de comprador, dirección, tarifa y método. Es la fuente inmutable de la publicación de venta, sin depender de cambios posteriores de precio.
- Los CHECK de reservas se aplican a las tablas usadas por todos los canales. No se confía solo en la pantalla web para impedir que POS o transferencias consuman unidades retenidas.
- La reserva no genera ingreso ni salida física. Se consume con la publicación de venta; se libera sin incrementar existencias cuando vence/cancela.
- La salida de productos, lotes, kardex, venta, pedido, auditoría y eventos se realiza en la misma transacción. El kardex utiliza el cliente transaccional también para consultar el método de costo.
- `Sale.shippingAmount` representa el ingreso neto de envío; el total se concilia con productos, impuestos y cobro. Las ventas anteriores conservan cargo cero. La devolución comercial se gestiona por pedido para evitar doble devolución por el flujo genérico de ventas.
- Un reembolso financiero no repone inventario automáticamente. La reposición física es explícita, idempotente y conserva el vencimiento de los lotes originales; un lote vencido repuesto no aparece como vendible.
- Los avisos comerciales pertenecen a cuenta/empresa. No se reutiliza el buzón laboral por User. Correos, avisos e historial se guardan junto a la operación, con versión del pedido.
- Las respuestas comerciales y administrativas nuevas llevan `Cache-Control: private, no-store`.

## Pasarela y recuperación

- API saliente fija: `https://api.mercadopago.com`. El checkout solo redirige a HTTPS de dominios de Mercado Pago permitidos, sin credenciales en la URL.
- La configuración verifica el receptor con `/users/me`. El token y secreto de webhook quedan cifrados, no se devuelven al frontend.
- No se permite sustituir receptor/entorno si la integración tiene pagos históricos. La rotación de token del mismo comercio sí es posible.
- Webhook: `/api/store-payments/webhooks/<publicId>`, firma HMAC de recurso, request y timestamp con ventana de diez minutos. Se consulta el pago a Mercado Pago y se verifica beneficiario, modo, referencia, importe y PEN.
- Los webhooks no usan el `status` del navegador ni del cuerpo como confirmación. Volver de la pasarela solo permite consultar el estado.
- La creación de preferencia usa un intento persistente y un arrendamiento. Si falla la red, el pedido permanece pendiente y la tarea recupera el intento fuera de las transacciones de inventario.
- La conciliación usa lotes pequeños con arrendamiento y rotación temporal para evitar solicitudes simultáneas o monopolizar siempre los mismos intentos.
- Un pago tardío se conserva como `PAID` / `REVIEW_REQUIRED` sin crear una venta ni quitar stock a otro cliente. El negocio concilia o devuelve.
- Importes distintos, cobros adicionales y devoluciones parciales se registran como incidencias para revisión. La interfaz incorpora su lista; el flujo automático de devolución implementado es **total**, no parcial.
- Las devoluciones confirmadas fuera de orden no requieren publicar una venta ficticia antes de liberar la reserva.
- Las tareas de expiración (30 s), correo (30 s) y recuperación de pasarela (60 s) utilizan estado persistente. La base de datos es la autoridad; Redis no es requisito para las reservas.

## Activación y despliegue

1. Aplicar migraciones con `npx prisma migrate deploy` y generar el cliente con `npm run prisma:generate`. Render ya ejecuta migrate deploy en su arranque.
2. Desde plataforma, incluir **Tienda virtual** (`storefront`) en el plan deseado. No se alteran automáticamente todos los planes o negocios.
3. Configurar SMTP real (`SMTP_ENABLED`, host, puerto, usuario, contraseña y remitente) y `FRONTEND_URL` con el origen público HTTPS del frontend.
4. El administrador de empresa entra en `/store`, habilita tienda/registro y publica su selección.
5. Configura pago/envío e impuestos; habilita compras solo después de revisar esas condiciones.
6. Para pasarela, usa token y secreto propios del comercio. Verifica la URL de webhook mostrada por la aplicación y configura ese webhook en Mercado Pago. El modo pruebas/producción debe coincidir con sus credenciales.
7. Ensaya primero una cuenta y una compra piloto. La validación automatizada utiliza respuestas controladas del PSP: no cobra dinero real ni prueba credenciales de un comercio no proporcionadas.

Las tiendas, el checkout y la publicación de productos comienzan desactivados. Un SMTP deshabilitado deja las cuentas pendientes de verificación: no se marca un mensaje como entregado ni se activa una cuenta para simular éxito.

Mantener los secretos JWT estables; si se rotan, las integraciones cifradas y correos pendientes deben reprovisionarse/reemitirse. Los mensajes entregados limpian el cuerpo cifrado. Tras diez fallos de correo, revisar la causa y reactivar el trabajo de forma operativa; no hay un envío infinito silencioso.

## Migraciones nuevas

- `20261111000000_store_accounts_catalog`: cuentas, sesiones, tokens de un solo uso, direcciones, cola de correo y publicación.
- `20261112000000_store_cart_reservations`: métodos, carrito, cotizaciones, reservas y constraints de disponibilidad.
- `20261113000000_store_orders_payments`: pedidos, historial, comprobantes, integración, pagos, eventos, devoluciones y cargo de envío en ventas.

Se ensayó la cadena histórica completa en una base vacía. Ese ensayo detectó y corrigió que la tabla de usuarios existente se llama `User` y no `users`; no se dio por válida únicamente una base mínima simulada.

## Verificación ejecutada

- Lint y builds de backend/frontend.
- Suite completa final de backend: **415 pruebas aprobadas**, incluyendo las **9 pruebas comerciales** actualizadas.
- Suite frontend: **84 pruebas aprobadas**.
- `npm run test:browser:store`: registro, acceso, edición de perfil, catálogo, carrito, cotización, confirmación, comprobante, revisión del administrador, preparación/retiro/entrega y vista móvil.
- `npm run test:browser:purchases`: regresión de catálogo interno y recepción de compras.
- La prueba visual de navegador usa un API controlado para verificar interfaz/contratos; la integración HTTP separada ejecuta los servicios Nest/Prisma y SQL reales sobre la base embebida, con respuestas controladas del proveedor de pagos.
- Integración HTTP con NestJS, Prisma y PostgreSQL embebido servido por socket: todas las migraciones, verificación de un solo uso, replay de refresh, aislamiento laboral/comercial y entre tiendas/cuentas, DTOs sin precios del comprador, idempotencia de pedido y pago, reservas, venta/kardex, devolución física separada, firma inválida/válida, webhook repetido, expiración y pago tardío.
- PGlite ejecuta el motor PostgreSQL con un multiplexor de conexiones: verifica SQL y operaciones Prisma reales, pero no sustituye un ensayo de carga multisesión en PostgreSQL de producción.

## Límites explícitos del primer alcance

- Una presentación por producto y pedido, igual que el contrato actual de ventas; cantidades por peso/volumen con hasta tres decimales.
- Checkout PEN, inventario central, retiro y entrega local por ubigeos. No se atribuye stock independiente a sucursales sin un modelo completo por ubicación.
- Pagos manuales, efectivo al recoger y Mercado Pago por empresa. No se guardan tarjetas/CVV ni se añaden otros PSP.
- Cotización sin cupones del comprador, crédito, ajuste posterior de peso ni entrega contra reembolso.
- Devolución total automática y registro físico explícito. Incidencias parciales/adicionales requieren conciliación del negocio.
- Las líneas históricas del pedido se conservan en snapshot JSON validado, no en una tabla redundante de líneas de pedido; la venta sí utiliza sus SaleItem existentes.

## Resultado al integrar

Cada empresa habilitada obtiene una tienda con clientes finales autenticados, catálogo propio, carrito, pago/envío, perfil, pedidos y seguimiento. El negocio administra publicación, cuentas y atención de pedidos desde su panel. Las operaciones comerciales mantienen aislamiento de empresa/propietario y conviven con POS, distribuidores y el cobro independiente de suscripciones.

El merge a `main` se realiza únicamente al terminar y verificar la tercera rama, que contiene las dos anteriores por ascendencia. Se conservan y publican las tres ramas para trazabilidad.
