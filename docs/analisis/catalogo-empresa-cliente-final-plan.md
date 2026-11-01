# Catálogo por empresa y portal de cliente final: análisis y plan por fases

Fecha: 2026-10-31.
Base revisada: `main`, commit `fe6abf6`.
Estado: análisis de referencia. La implementación y sus resultados por fases se documentan en [Implementación del portal comercial](../implementacion-tienda.md). Las propuestas de este documento se conservan para trazabilidad; el documento de implementación identifica el alcance efectivamente entregado y sus requisitos operativos.

## 1. Objetivo y alcance

Permitir que cada empresa publique los productos que ofrece en un portal propio y que un usuario de tipo **`USUARIO_CLIENTE_FINAL`** tenga una cuenta vinculada a esa empresa para consultar el catálogo y comprar.

Módulos solicitados:

1. Catálogo de productos de la empresa.
2. Carrito de compras.
3. Métodos de pago.
4. Métodos de envío.
5. Perfil e información del cliente: nombres, apellidos, DNI, teléfono y dirección.

Se añaden dos piezas necesarias para que esos módulos formen un flujo completo:

- **Mis pedidos**: confirmación, estado del pago, preparación y entrega.
- **Administración de la tienda por la empresa**: publicación de productos, configuración de pagos/envíos y atención de pedidos.

La propuesta es una tienda por empresa sobre el inventario existente. No se plantea un marketplace con un carrito que mezcle varias empresas.

## 2. Resumen ejecutivo

### Recomendación principal

Construir un **portal comercial separado del panel administrativo**, reutilizando productos, clientes, infraestructura de autenticación, inventario y ventas cuando sus contratos sean compatibles.

Separar expresamente:

- La identidad que inicia sesión (`User`).
- La membresía del personal (`Membership`).
- La ficha comercial del comprador (`Customer`).
- La nueva cuenta del comprador dentro de una empresa (`CustomerAccount`).

El nuevo tipo de usuario se representará como `USUARIO_CLIENTE_FINAL` en el contexto del portal. **No se recomienda incorporarlo como una membresía laboral ordinaria**. La cuenta de cliente tendrá permisos, sesión y navegación propias.

También se debe separar:

- Catálogo administrativo y catálogo visible al comprador.
- Pedido, pago, preparación/envío y venta contable.
- Cobro de la suscripción del SaaS y cobro de productos de una empresa.
- Existencias físicas, reservas temporales y disponibilidad real para comprar.

### Entregas recomendadas

| Entrega | Resultado |
| --- | --- |
| Portal consultivo | Registro, acceso, perfil y catálogo privado de la empresa. |
| Comercio con pagos manuales | Carrito, cotización, pago/revisión manual o efectivo al recoger, pedidos y operación básica. |
| Comercio integrado | Pasarela por empresa, conciliación, seguimiento de entrega y operación automatizada. |

El catálogo consultivo puede liberarse primero. El botón de comprar solo se habilitará cuando estén implementados pedidos, disponibilidad transaccional y cobro correspondiente.

## 3. Estado real del proyecto

### 3.1 Capacidades existentes

| Área | Lo que existe | Implicación para el portal |
| --- | --- | --- |
| Empresas | `Company.slug` único, moneda, zona horaria y estados operativos. | Se puede resolver la tienda por una URL de empresa. No equivale a que ya exista una tienda publicada. |
| Identidad | `User.email` es único globalmente, contraseña con Argon2 y `authVersion`. | Se pueden reutilizar credenciales, pero el alta de comprador necesita un flujo propio. |
| Personal | `Membership` tiene roles laborales y unicidad `[userId, companyId]`. | Un rol de comprador en esta misma tabla interferiría con cupos y coexistencia de roles. |
| Clientes | `Customer` ya tiene nombres, apellidos, correo, teléfono, documento y dirección. | Es una ficha comercial, no una cuenta de acceso. No tiene relación con `User`. |
| Productos | Categoría, nombre, descripción, imagen, precio, unidad base, presentaciones y estado. | Buena base para el catálogo; faltan publicación y proyección comercial de datos. |
| Catálogo interno | `GET /products/catalog` ya pagina y filtra productos del negocio. | Es interno y devuelve, entre otros datos, `costPrice`, stock y mínimos. No debe reutilizarse como respuesta al comprador. |
| Carrito | No existe un carrito persistente de cliente final. | Se necesita un dominio propio. El formulario del POS no lo sustituye. |
| Ventas | `SaleChannel.ONLINE` ya está en el esquema y el DTO de venta. | La presencia del enum no significa que exista comercio electrónico. |
| Creación de ventas | `SalesService.createSale` crea una venta con estado completado por defecto y `paidAmount = totalAmount`. | No representa un pedido pendiente de pago y no puede exponerse directamente al comprador. |
| Líneas de venta | `SaleItem` tiene unicidad `[saleId, productId]`; el helper rechaza presentaciones diferentes del mismo producto. | El carrito inicial debe respetar esa restricción o se debe migrar todo el contrato de líneas. |
| Inventario | Stock, movimientos, kardex y lotes; decrementos condicionales en operaciones. | Se pueden aprovechar, pero aún no hay reservas temporales de checkout. |
| Lotes | `reserveFromBatch` descuenta cantidad de lotes durante la venta. | A pesar del nombre, no es una reserva temporal con vencimiento y liberación. |
| Distribuidores | Las transferencias descuentan stock central y mantienen saldos propios. | No hay que descontar nuevamente esos saldos del stock central al calcular disponibilidad. |
| Pagos | `Payment` referencia obligatoriamente una `Subscription`. | Son cobros del SaaS, no pagos de pedidos. |
| Métodos de venta | El enum incluye Yape/Plin, pero `CreateSaleDto` solo admite `CASH`, `CARD` y `TRANSFER`. | La publicación de ventas comerciales deberá ampliar/normalizar el contrato y sus reportes, no asumir que el enum basta. |
| Configuración de pagos | `PaymentSetting` tiene proveedor único global y carece de `companyId`. | No sirve como cuenta receptora independiente de cada tienda. |
| Mercado Pago | Gateway orientado a planes, con token de entorno de la plataforma. | Hay patrones reutilizables de verificación, pero no una integración comercial multicomercio. |
| Envíos | No hay entidades de dirección múltiple, tarifa comercial, envío o seguimiento de pedido. | Se necesita configuración y persistencia nuevas. |
| Notificaciones | Infraestructura de notificaciones, email y outbox. | Se pueden reutilizar transportes y patrones, no los buzones internos sin cambiar su alcance. |

### 3.2 Archivos comprobados y consecuencias concretas

- `backend/prisma/schema.prisma`: `User`, `Membership`, `Customer`, `Product`, `ProductPresentation`, `Sale`, `SaleItem`, `Payment`, `PaymentSetting`, `RefreshToken` y `ProductBatch`.
- `backend/src/modules/auth/auth.service.ts`: `register()` crea una empresa, suscripción y administrador; `login()` elige la primera membresía laboral activa. Ninguno es el registro de cliente final.
- `backend/src/modules/auth/jwt.strategy.ts`: exige sesión vigente y membresía activa para un usuario ordinario; reconstruye roles desde la base de datos. La estrategia no distingue todavía un comprador de un empleado mediante una audiencia de token.
- `backend/src/common/guards/subscription-limit.service.ts`: cuenta todas las membresías activas como usuarios del plan. El límite de fichas de cliente se deriva hoy de `maxProducts * 5`.
- `backend/src/modules/products/products.service.ts`: la selección administrativa contiene costos, mínimos y existencias.
- `backend/src/modules/sales/sales.service.ts`: fija vendedor, cobro completo y salida de stock durante la creación de una venta.
- `backend/src/common/helpers/sale-pricing.helper.ts`: calcula precios y factores con `Prisma.Decimal`; admite una sola presentación/precio por producto en cada venta.
- `backend/src/modules/product-batches/product-batches.service.ts`: el consumo de lotes ordena por vencimiento, pero la consulta de consumo no excluye expresamente lotes ya vencidos.
- `backend/src/modules/payments/payments.controller.ts` y `mercado-pago.gateway.ts`: contratos de pago de suscripciones y beneficiario de la plataforma.
- `backend/src/modules/notifications/notifications.controller.ts`: el buzón personal y el stream se consultan por usuario. No deben convertirse directamente en un buzón del comprador multitienda.
- `backend/src/modules/outbox/outbox-event.helper.ts`: efectos tipados y deduplicación por tipo/entidad. Un cambio repetible de estado de pedido necesitará además una versión del evento.
- `frontend/proxy.ts`, `frontend/lib/role-navigation.ts` y `frontend/app/(dashboard)/layout.tsx`: navegación para plataforma/personal; no hay layout comercial de comprador.
- `frontend/lib/session-contract.ts`: falta expresar audiencia y cuenta de comprador en el contrato de sesión/cache.

### 3.3 Frontera de acceso que debe resolverse antes del alta de compradores

Hoy hay endpoints internos protegidos por JWT y tenant sin un permiso laboral explícito en cada lectura. Por ejemplo, varias lecturas de `/payments` no declaran roles. Además, `RolesGuard` y `PermissionsGuard` permiten continuar cuando no hay metadatos de roles/permisos.

Esto **no significa que un comprador ya pueda acceder**: el comprador todavía no existe en el sistema. Significa que añadirlo como una membresía corriente y ampliar el login sin separar audiencias podría abrir rutas internas accidentalmente.

Antes de emitir la primera sesión de comprador, el acceso por audiencia debe ser de denegación predeterminada: una sesión comercial solo llega a endpoints comerciales expresamente autorizados.

## 4. Decisiones funcionales propuestas

Estas son las bases recomendadas para estimar e implementar. Los puntos comerciales pendientes se listan en la sección 20.

| Decisión | Propuesta inicial |
| --- | --- |
| Tipo de usuario | `USUARIO_CLIENTE_FINAL`; etiqueta en pantalla: “Cliente final”. |
| Alcance | Cuenta de cliente vinculada a una empresa, con datos y pedidos propios en ella. |
| Identidad | Un `User` para credenciales; un `CustomerAccount` por empresa donde compre. |
| Visibilidad | Catálogo privado: requiere registro/acceso. Solo portada, información comercial y autenticación son públicas. |
| Publicación | Productos existentes no se publican automáticamente; visibilidad comercial explícita, inicialmente desactivada. |
| Precio | Mismo precio de venta/presentación que el negocio en el MVP; sin listas especiales por cliente. |
| Moneda | Moneda de la empresa; despliegue comercial inicial en PEN si se usa la integración actual como punto de partida. Bloquear monedas sin soporte integral. |
| Stock | Inventario central de la empresa en el MVP. Retiro en una sucursal no implica que exista inventario autónomo por sucursal. |
| Carrito | Persistente en servidor y separado por cuenta/empresa; no reserva existencias. |
| Reserva | Se crea al confirmar un pedido, con vencimiento y límites, no al agregar al carrito. |
| Pedido | Entidad independiente con snapshots, estados e idempotencia. |
| Pagos iniciales | Transferencia/Yape/Plin con revisión del negocio; efectivo al recoger solo con confirmación de cobro al entregar. |
| Tarjetas/pago online | Fase específica con proveedor y beneficiario de la empresa, no de la plataforma. |
| Envío inicial | Retiro en local y entrega local por zonas con tarifa calculada en servidor. |
| Direcciones | Una o varias direcciones del comprador en esa empresa; una predeterminada. |
| Datos personales | Registro básico y perfil completo antes de comprar; dirección obligatoria para entrega a domicilio. |
| Productos por peso | Se permiten cantidades fraccionarias con precisión/step explícitos; sin ajuste de peso posterior en el primer MVP. |
| Presentaciones | Una presentación por producto en un carrito/pedido inicial, para respetar el modelo actual de ventas. |
| Historial previo del POS | No se expone automáticamente por coincidencia de DNI/correo. Requiere vinculación comprobada. |

## 5. Identidad, empresa y nuevo tipo de usuario

### 5.1 Modelo recomendado

```text
User: identidad y credenciales
  ├── Membership: personal de empresa / rol laboral existente
  └── CustomerAccount: acceso comercial del comprador
        ├── companyId: empresa de la tienda
        ├── role: USUARIO_CLIENTE_FINAL
        ├── customerId: ficha comercial de esa empresa
        ├── estado y verificación
        ├── direcciones
        ├── carrito
        └── pedidos
```

No se almacenan contraseñas en `Customer` ni se duplican hashes en `CustomerAccount`.

Un usuario puede ser empleado de A y comprador de A o B. Cada sesión tiene **un contexto activo**, no la unión de todos sus roles. Una sesión del portal no obtiene permisos de administrador porque ese mismo `User` también sea administrador en otro contexto.

El uso de `User.email` global es una decisión explícita: las credenciales pueden ser comunes, pero la relación, direcciones y compras pertenecen a cada empresa. Si se desean contraseñas totalmente independientes por empresa y un mismo email repetido como identidades distintas, habría que rediseñar la unicidad actual y estimarlo por separado.

### 5.2 Registro dentro de una empresa

1. El comprador entra a `/tienda/<empresaSlug>/registro`.
2. El servidor resuelve una tienda habilitada a partir del slug; no acepta un rol ni un `companyId` libre del formulario.
3. Se validan datos y límites comerciales de registro, separados de los cupos de personal.
4. Si el email no existe, se crea `User` con `globalRole = USER`, ficha `Customer` y cuenta comercial pendiente de verificación.
5. Si el email ya pertenece a un `User`, no se sustituye su contraseña ni se vincula automáticamente: debe iniciar sesión o completar un mecanismo de control del correo previamente definido.
6. Si ya hay una ficha de cliente con el mismo documento/correo en esa empresa, se resuelve la vinculación comprobada; una coincidencia de texto no concede acceso a la ficha ni a sus ventas.
7. Se verifica el email y se activa la cuenta según la política de la tienda.
8. Se inicia una sesión de audiencia comercial limitada a esa cuenta/empresa.

No se llama a `AuthService.register()` actual: ese flujo registra un negocio nuevo y un administrador.

Estados propuestos para la cuenta: `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `CLOSED`.

La verificación requiere un transporte de correo operativo. Los tokens serán de propósito único, almacenados como hash, con vencimiento y consumo de un solo uso; el reenvío tendrá límites. Si el transporte falla o está deshabilitado, la cuenta permanece pendiente y la interfaz no afirma que el correo se envió o que la identidad está verificada. La entrega se recupera mediante trabajo durable.

El administrador de A puede suspender la cuenta comercial en A, no `User.isActive` global ni la cuenta del mismo usuario en B.

### 5.3 Sesión y autenticación

- Añadir audiencia de sesión, por ejemplo `STAFF`, `PLATFORM` y `STORE`.
- Sesión STORE: `sub`, `sid`, `aud`, `authVersion`, `companyId`, `customerAccountId` y rol comercial. Los identificadores se validan contra la base de datos en cada autenticación, no se confían solo por estar en el JWT.
- Una estrategia comercial específica valida cuenta activa, ficha correspondiente, sesión no revocada y coincidencia con el slug de la ruta.
- La estrategia interna rechaza explícitamente tokens STORE, incluso si ese usuario también tiene membresía laboral.
- El guard global actual usa la estrategia `jwt` para todo lo no público. Se debe refactorizar a selección explícita de audiencia/estrategia por metadatos; no marcar todo `/store` como `@Public()` para eludirlo.
- Los endpoints nuevos son públicos solo cuando corresponde: portada, registro, login, verificación/recuperación y webhook firmado.
- Reutilizar Argon2, rotación de refresh tokens, revocación, protección CSRF y cookies HttpOnly.
- Añadir audiencia y cuenta comercial a las sesiones persistidas/refresh. Renovar no puede cambiar de empresa ni elevar audiencia.
- Usar cookies comerciales diferenciadas (`store_access_token`, `store_refresh_token`) para no pisar la sesión administrativa en el mismo navegador. Propuesta inicial: HttpOnly, Secure en producción, SameSite=Lax y Path=/ para que lleguen tanto a páginas `/tienda` como al API/proxy de sesión; el nombre y la selección de audiencia determinan qué contexto las consume. Definir TTL y forwarding explícitos, sin elegir la primera cookie disponible.
- El cliente API y la sesión de servidor deben elegir el contexto correcto; no reenviar automáticamente una cookie laboral al API comercial ni viceversa.
- Las claves de TanStack Query y cualquier estado persistido incorporan audiencia, empresa y cuenta. Logout/cambio de tienda limpian los datos de ese contexto.

Cambiar la contraseña de la identidad común debe invalidar las sesiones pertinentes mediante `authVersion`; suspender una cuenta comercial solo revoca sesiones de esa cuenta.

### 5.4 Vinculación de clientes históricos

`Customer` tiene unicidad de email y documento por empresa. Debe conservarse y tratar conflictos de forma atómica.

- No duplicar una ficha histórica para esquivar un conflicto de unicidad.
- No permitir que un alta pública modifique una ficha existente usando solo su DNI.
- Verificar control del email/contacto o utilizar una invitación de vinculación, con token de un solo uso y vencimiento.
- En casos sin identidad/contacto comprobable, dejar la cuenta pendiente y permitir resolución explícita del negocio.
- Conservar quién vinculó, qué se verificó y cuándo.
- El historial comercial solo se habilita para la ficha vinculada y según política explícita; en el MVP basta mostrar los pedidos creados por esa cuenta.

## 6. Datos del cliente y perfil

### 6.1 Fuente de los datos

`Customer` conserva los datos comerciales por empresa. `CustomerAccount` conserva identidad de acceso, vínculo y estado. `User.email` es el identificador de acceso; `Customer.email` puede funcionar como correo comercial si se distingue claramente su edición/verificación.

Modificar el nombre comercial en A no debe cambiar silenciosamente el perfil laboral o los datos comerciales en B.

### 6.2 Campos y validaciones

| Campo | Propuesta |
| --- | --- |
| Nombres | `Customer.firstName`; requerido, texto Unicode, longitud limitada, espacios normalizados. |
| Apellidos | `Customer.lastName`; requerido para el perfil de compra. |
| Correo | Email de acceso verificado; cambios mediante flujo verificado, no simple PATCH de autenticación. |
| DNI | `documentType = DNI`, `documentValue` como string de 8 dígitos; no convertir a número. Validar formato no equivale a verificar identidad. |
| Teléfono | String normalizado con prefijo de país; presentar formato legible. Validación peruana según alcance comercial inicial. |
| Dirección | Dirección estructurada para entrega, con referencia opcional. |
| Departamento/provincia/distrito | Valores coherentes y código ubigeo cuando corresponda. |
| Contacto de recepción | Nombre y teléfono, pueden diferir del titular de la cuenta. |
| Preferencias | Método de pago/envío preferido; siempre revalidado al comprar. |
| Privacidad | Versiones y fechas de aceptación del aviso/condiciones; marketing separado y opcional. |

Propuesta de captura: nombres, apellidos, email y contraseña para registrarse; teléfono y documento antes de confirmar la primera compra; dirección antes de contratar entrega. Si el negocio exige todos los datos desde el registro, es un ajuste de UX/validación, no otro modelo.

No incluir notas internas de `Customer.notes`, estadísticas de rentabilidad, flags administrativos o datos de otros clientes en la respuesta `/me`.

La API de DNI existente está orientada al personal, permisos y cuota. No se abrirá al comprador como directorio de personas. El DNI no será contraseña ni mecanismo de recuperación.

### 6.3 Direcciones e historial

- `CustomerAddress` pertenece a empresa y cuenta; se verifica propiedad antes de leer/editar/eliminar.
- Cambio de dirección predeterminada transaccional para evitar dos predeterminadas activas.
- Al crear el pedido se guarda un snapshot de la dirección y del destinatario.
- Cambiar el perfil o borrar una dirección no modifica pedidos anteriores.
- Editar un envío pendiente requiere un flujo de cambio que recalcule tarifa y elegibilidad; no se resuelve modificando retroactivamente el perfil.

## 7. Catálogo para comprador

### 7.1 Administración de publicación

El negocio necesita poder:

- Habilitar/pausar su tienda y registro de clientes.
- Definir nombre comercial, portada/logo, descripción, horarios y contacto público.
- Elegir productos publicados, destacados y orden de presentación.
- Revisar imágenes y descripciones comerciales.
- Definir si se muestran agotados y cómo se presenta la disponibilidad.
- Previsualizar la tienda como catálogo, sin acceder a la cuenta personal de un cliente.

Campos iniciales sugeridos: `Product.storeVisible = false`, `storeSortOrder`, `storeFeatured`. Un texto/título comercial alternativo es opcional, no requiere duplicar todo `Product`.

Publicable significa: misma empresa, producto activo, no eliminado, explícitamente visible y tienda habilitada. Las presentaciones también deben estar activas. Las categorías visibles solo incluyen productos publicables.

### 7.2 Datos que puede recibir el cliente

```ts
interface StoreProductDto {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: { id: string; name: string } | null;
  baseUnit: "UNIT" | "KG" | "LT" | "MT";
  price: string;
  currency: string;
  priceIncludesTax: boolean;
  availability: "AVAILABLE" | "OUT_OF_STOCK";
  quantityStep: string;
  minimumQuantity: string;
  presentations: Array<{
    id: string;
    name: string;
    factor: string;
    price: string;
  }>;
}
```

Es un contrato propuesto, no un DTO ya creado. Importes como strings decimales, sin costos ni datos operativos.

No devolver `costPrice`, margen, stock reservado, mínimos, proveedor, movimientos, saldos de distribuidores, lotes internos o información de otros clientes. El backend usa un `select` comercial explícito; no filtra un `Product` completo solo desde React.

Mostrar “Disponible/Agotado” por defecto. Exponer cantidades exactas será una decisión comercial adicional, no necesaria para consultar el catálogo.

### 7.3 Navegación y rendimiento

- Tarjetas con imagen, descripción breve, precio por unidad/presentación y disponibilidad.
- Búsqueda por nombre y categorías; paginación del servidor y orden estable.
- Detalle de producto con presentaciones y step de cantidad.
- Mensajes claros para producto no publicado, agotado o tienda pausada.
- Imágenes optimizadas derivadas de medios propios/autorizados; limitar payloads base64 existentes en listados.
- Catálogo privado sin indexación pública. Si luego se habilita catálogo público, añadir políticas de publicación, SEO y caché específicas.
- Cachear datos comerciales solo con clave de empresa/configuración. Perfil, carrito, direcciones y pedidos usan `no-store` o caché estrictamente privada.
- La compra siempre revalida precio/stock en servidor aunque el listado esté cacheado.

## 8. Carrito y cotización

### 8.1 Carrito persistente

Entidades `Cart` y `CartItem`, con un carrito activo por cuenta/empresa. Incluye `version` para controlar actualizaciones simultáneas entre dispositivos/pestañas.

Una línea contiene producto, presentación elegida y cantidad. El precio mostrado puede guardarse como referencia, pero no es autoridad para cobrar.

Reglas:

1. Solo productos visibles/activos y presentaciones válidas de la empresa.
2. Cantidades positivas, límites por línea/pedido y precisión representable.
3. Unidad discreta y presentación: cantidad entera. KG/LT/MT: step y precisión definidos, hasta los tres decimales del inventario.
4. Precio de presentación explícito o precio base multiplicado por factor, siguiendo reglas compartidas del negocio.
5. Producto retirado o precio cambiado: marcar incidencia y solicitar revisión, no borrar silenciosamente ni cobrar otro total sin confirmación.
6. Carrito no descuenta ni reserva existencias.
7. En el MVP, el mismo producto no puede estar simultáneamente como unidad y caja: la venta actual no lo representa. Ofrecer reemplazar la presentación o mostrar conflicto explícito.

Permitir múltiples presentaciones del mismo producto exige migrar `SaleItem`, el helper de precios, devoluciones/notas de crédito y reportes. Es una ampliación posterior, no un detalle exclusivo del carrito.

### 8.2 Cotización antes de confirmar

`POST /store/:slug/checkout/quote` recalcula:

- Productos, cantidades y factores.
- Precio vigente autorizado.
- Descuentos admitidos por reglas del servidor; descuentos manuales del POS no son una opción del comprador.
- Impuestos según política comercial del negocio.
- Dirección y zona elegible.
- Método de envío y tarifa.
- Método de pago habilitado y compatible con ese envío.
- Disponibilidad orientativa en ese momento.

Se devuelve una cotización persistida con `quoteId`, versión de carrito/configuración, moneda y vencimiento breve propuesto de 5 minutos.

El usuario confirma esa cotización. Si cambia un componente relevante o vence, se responde con una incidencia de recotización antes de crear/cobrar el pedido. Una cotización por sí sola no garantiza stock.

El cliente no envía como autoridad `unitPrice`, `totalAmount`, `taxAmount`, `shippingFee`, descuentos, `paidAmount`, `customerId`, rol o empresa de destino. Envía selecciones y referencias; el servidor deriva propietario y valores.

## 9. Disponibilidad, reservas y convivencia con el POS

### 9.1 El punto de consistencia

Agregar un módulo web que revise stock y lo descuente mucho después permitiría que el POS, un distribuidor y dos compradores gasten las mismas unidades.

La disponibilidad para compra debe ser:

```text
existencias vendibles del origen definido
  - reservas activas y no vencidas del mismo origen
  = disponibilidad para una nueva operación
```

“Vendible” no incluye lotes vencidos ni existencias bloqueadas. Debe reconciliarse con `Product.stockQuantity` y `ProductBatch.quantityAvailable` antes de habilitar compras. Las transferencias a distribuidores ya reducen el stock central: restarlas otra vez sería incorrecto.

No se asumirá inventario por sucursal solo porque `ProductBatch.branchId` exista. El alcance inicial es central; el inventario completo por ubicación requiere diseño adicional.

### 9.2 Reserva temporal propuesta

- `StockReservation`: pedido, empresa, producto/origen, cantidad base, estado y vencimiento.
- `StockReservationAllocation`: lotes asignados a esa reserva y cantidades.
- Contadores `reservedQuantity` en producto/lote pueden acelerar disponibilidad; son agregados que deben actualizarse junto con las reservas y conciliarse.
- Crear la reserva no genera salida de kardex ni ingreso por venta.
- En una conversión confirmada se consume la reserva y se descuenta inventario físico exactamente una vez.
- Cancelar/vencer libera solo reservas activas, mediante transición atómica, sin incrementar stock físico que nunca se descontó.
- `ProductBatchesService.reserveFromBatch()` actual no sirve como hold: hoy consume existencias. Se extraerán operaciones diferenciadas de retener, liberar y consumir.

### 9.3 Requisito transversal obligatorio

Todos los canales que consumen stock deben respetar las reservas: POS, venta online, transferencia a distribuidor, salida/ajuste negativo y operaciones futuras.

No basta con modificar el nuevo checkout. Se debe centralizar la disponibilidad/debito o añadir el mismo invariante a todos esos caminos.

Usar transacciones con bloqueo/aislamiento apropiado y actualizaciones condicionales. Bloquear productos/lotes en orden estable y reintentar conflictos serializables de forma acotada. El cálculo decimal evita tolerancias de punto flotante.

El vencimiento de un lote se interpreta como fecha comercial en la zona horaria del negocio. Definir si “vence hoy” puede venderse hasta el cierre del día; no aplicar una regla distinta según el servidor esté en UTC o Lima. Revalidar la aptitud del lote antes de la entrega.

### 9.4 TTL, límites y recuperación

- Propuesta inicial: 15 minutos para pago online; ventana manual configurable para comprobantes; retiro pendiente con plazo confirmado por el negocio.
- Limitar reservas/pedidos impagos activos por cuenta para no inmovilizar el inventario con carritos abandonados.
- La tarea de vencimientos debe funcionar con múltiples procesos y ser recuperable. BullMQ puede apoyar; la base de datos conserva la verdad y un barrido programado recupera trabajos perdidos.
- No confiar solo en TTL de Redis para restituir disponibilidad.
- Un comprobante o webhook recibido después del vencimiento no reactiva automáticamente el pedido ni consume stock de otro comprador.
- Si se recibió dinero y ya no hay inventario, pasar a conciliación/devolución y notificar; no crear una venta que sobrepase existencias.
- Cambios de unidad base/factor de presentación y ajustes que afecten reservas requieren validación explícita; no alterar unidades de un pedido pendiente silenciosamente.

## 10. Pedidos y conversión a venta

### 10.1 Entidades y snapshots

`StoreOrder` representa el compromiso comercial. `StoreOrderItem` conserva nombre, presentación, factor, cantidad, precio e impuestos aceptados, aunque el catálogo cambie después.

Guardar también snapshots de comprador, dirección, método/tarifa de envío, instrucciones de pago aplicadas y política de precios/impuestos. Los secretos de integración nunca se copian al pedido.

`StoreOrder.saleId` será único cuando la venta se genere. El número legible del pedido es único por empresa; los IDs opacos no sustituyen controles de propiedad.

### 10.2 Estados separados

| Dimensión | Estados propuestos |
| --- | --- |
| Pedido comercial | `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `EXPIRED`, `REVIEW_REQUIRED`, `COMPLETED`. |
| Pago | `PENDING`, `UNDER_REVIEW`, `PAID`, `FAILED`, `CANCELLED`, `PARTIALLY_REFUNDED`, `REFUNDED`. |
| Preparación/entrega | `UNFULFILLED`, `PREPARING`, `READY_FOR_PICKUP`, `SHIPPED`, `DELIVERED`, `CANCELLED`. |
| Reserva | `ACTIVE`, `CONSUMED`, `RELEASED`, `EXPIRED`. |

Son catálogos propuestos; las transiciones permitidas se definen como máquina de estados y no mediante PATCH arbitrario.

“Pagado” no significa “Entregado”. “Método elegido” no significa “Pago recibido”. “Comprobante subido” no significa “Pago aprobado”.

### 10.3 Flujo principal

```text
Catálogo → Carrito → Dirección/métodos → Cotización aceptada
  → Transacción: pedido pendiente + snapshots + reserva + evento durable
  → Crear intento/instrucción de pago fuera de la transacción
  → Confirmar pago mediante revisión autorizada o proveedor verificado
  → Transacción: pago + pedido + reserva consumida + venta ONLINE
                 + movimiento + kardex + evento durable
  → Preparar → Retiro/envío → Entrega
```

No hacer llamadas a proveedores dentro de la transacción que bloquea stock. Si la creación de una preferencia falla o tarda, el intento se reintenta idempotentemente y el pedido sigue en un estado visible.

La conversión debe extraerse a un servicio transaccional reutilizable, por ejemplo `SalePostingService`, que acepte un `tx` y una intención interna ya validada. No anidar una llamada al `createSale()` actual que vuelva a calcular/importar cobro completo o descuente stock dos veces.

La publicación usa los precios/factores aceptados en el snapshot del pedido, no un nuevo precio de catálogo que haya cambiado durante el pago. Esto requiere una entrada interna confiable diferenciada del DTO del comprador; no habilitar una opción pública de sobrescritura de precios para eludir la validación del helper actual.

El actor de la compra es el cliente, pero no es el vendedor laboral. Registrar `customerAccountId` y origen de pedido; `sellerId` debe ser null/sistema o un responsable comercial definido. No atribuir ventas al comprador como si fuese empleado.

### 10.4 Efectivo al recoger

Puede aceptarse un pedido sin marcarlo pagado y reservar/preparar según la política del negocio. Al recoger, un operador autorizado confirma recepción de efectivo; en esa operación se registra el pago, se convierte a venta y se consume la reserva una vez.

Si no recoge dentro del plazo, se cancela/vencen reservas. No se utiliza `paidAmount = totalAmount` anticipadamente. Contraentrega a domicilio, crédito y pagos parciales quedan fuera del primer MVP, salvo que se diseñen expresamente sus transiciones y cobranza.

### 10.5 Idempotencia y concurrencia

- Confirmación de pedido con clave de idempotencia, alcance empresa/cuenta y fingerprint del contenido.
- Misma clave y mismo contenido devuelve el mismo pedido; misma clave con contenido diferente produce conflicto.
- Carrito/versiones y cotización se validan dentro de la confirmación.
- `saleId` único por pedido y evento de conversión deduplicado.
- Pago manual, webhook y expiración compiten mediante transiciones condicionales de estado/versión.
- Un doble clic, reenvío de red o webhook repetido nunca genera dos salidas, dos ventas ni dos cobros.

## 11. Métodos de pago

### 11.1 Qué verá el comprador

La pantalla de métodos de pago muestra los métodos habilitados por la empresa, sus instrucciones públicas y la selección preferida del comprador.

No es un repositorio de números completos de tarjeta/CVV. Las tarjetas, si se incorporan, usan checkout alojado o tokenización del proveedor; en el MVP ni siquiera es necesario guardar tarjetas.

### 11.2 Configuración por empresa

Separar:

- `StorePaymentMethod`: tipo, nombre, habilitado, orden, instrucciones/QR público y compatibilidades.
- `StorePaymentIntegration`: credenciales cifradas, proveedor, identificador de comercio, entorno y estado de integración; solo backend/administración autorizada.
- `OrderPaymentAttempt`: importe, moneda, pedido, proveedor/cuenta receptora, referencias, estado y timestamps.
- `OrderPaymentProof`: comprobantes manuales con acceso privado, revisión y notas.
- `OrderRefund` y registro de eventos verificados cuando se habiliten devoluciones/gateway.

La configuración global `PaymentSetting` y los pagos `Payment` de la suscripción siguen representando el cobro del SaaS. No deben reutilizarse como receptor comercial de todas las tiendas.

### 11.3 Pagos manuales

1. El pedido registra el método y las instrucciones vigentes aceptadas.
2. El comprador paga al negocio y carga comprobante si el método lo requiere.
3. El sistema marca `UNDER_REVIEW`, no `PAID`.
4. Un operador de esa empresa revisa y aprueba/rechaza, con motivo y auditoría.
5. Aprobar verifica pedido, importe, moneda, ventana/reserva e idempotencia.
6. Los archivos se almacenan privadamente con límites de tamaño/tipo y enlaces autorizados de duración acotada.

Distinguir confirmación de recepción de dinero de la aceptación de una imagen. Un hash de imagen repetida puede ayudar a revisar duplicados, pero no prueba un pago.

### 11.4 Pasarela online

- El comercio receptor debe pertenecer a la empresa correspondiente. Resolver si se usarán credenciales propias por empresa u onboarding/OAuth del PSP.
- No emplear `MERCADOPAGO_ACCESS_TOKEN` de la plataforma para cobrar productos de todas las empresas sin un modelo comercial de intermediación explícito.
- Crear referencia de pedido/intento en servidor y verificar firma del webhook.
- Consultar el pago al proveedor desde el backend; no confiar en `status`, importe o empresa enviados por el navegador.
- Comparar beneficiario, pedido/intento, moneda, importe, entorno y referencia antes de confirmar.
- Identidad de pago externa única por integración/comercio y proveedor; no asociar el mismo pago a dos pedidos.
- La vuelta a una URL de “éxito” solo refresca el estado. No confirma dinero recibido.
- Tratar duplicados, estados fuera de orden, timeout, importe incorrecto, pago tardío y devolución.
- Los webhooks verificados y la conciliación de pedidos existentes continúan funcionando si se pausa la tienda o vence el plan; no deben perderse cobros ya efectuados.
- Si el checkout alojado requiere redirección/SDK, adaptar CSP y destinos permitidos solo para el proveedor elegido.

## 12. Métodos de envío

### 12.1 Modalidades propuestas

| Modalidad | Datos y reglas |
| --- | --- |
| Retiro en local | Punto de retiro, dirección pública, horario, plazo y eventual costo cero. |
| Entrega local | Dirección elegible, zona/ubigeo, tarifa fija inicial y plazo estimado. |
| Courier nacional | Extensión posterior con cobertura, tracking y tarifación integrada. |

`StoreShippingMethod` describe el servicio. `ShippingZone` describe cobertura y reglas/tarifa. `OrderShipment` describe la ejecución de un pedido concreto.

El método preferido del cliente no es una autorización de entrega ni una tarifa garantizada. La selección se revalida para el pedido.

### 12.2 Reglas

- Dirección y método deben pertenecer a la misma empresa/cuenta/configuración.
- El backend determina zona y tarifa; no acepta el costo que envía React.
- Definir condiciones de gratuidad, pedido mínimo y compatibilidad con pago.
- Si la dirección no tiene cobertura, bloquear confirmación y ofrecer retiro si está habilitado.
- La entrega conserva snapshot de dirección, contacto, tarifa y plazo ofrecido.
- Cambios posteriores que alteran tarifa/cobertura requieren recotización y consentimiento.
- Tracking se limita a códigos/destinos autorizados; no se hace fetch a URLs arbitrarias suministradas por clientes.

### 12.3 Envío, impuestos y contabilidad

El total actual de venta es `subtotal + taxAmount - discountAmount`; no hay un componente específico de envío.

Antes de cobrar entregas se debe representar explícitamente su ingreso y posible impuesto en pedido y contabilidad. La propuesta es añadir un componente de envío a la publicación de ventas y adaptar helpers, reportes y reversos, con valor cero para ventas anteriores.

```text
total del pedido = subtotal de productos - descuentos
                 + impuestos de productos
                 + cargo de envío + impuestos de envío
```

Cada impuesto debe definirse sin duplicarlo cuando los precios ya lo incluyan. La configuración visual `InvoiceTemplate.taxPercentage` no será la fuente automática de tributación del checkout.

Se acordará una política de impuestos del negocio. No asumir un 18% general para todos los productos y tarifas sin esa definición.

No ocultar el envío en notas, sumarlo como un producto ficticio o producir una venta cuyo importe no pueda conciliarse con el cobro. La política de devolución del cargo de envío también debe ser explícita.

## 13. Modelo de datos propuesto

Es un diseño conceptual. Las migraciones exactas se redactarán por fase y con sus constraints completos.

| Entidad/cambio | Campos y relaciones principales |
| --- | --- |
| `CustomerAccount` | `id`, `companyId`, `userId`, `customerId`, rol `USUARIO_CLIENTE_FINAL`, estado, verificación, fechas; único por empresa/usuario y vínculo de ficha comercial controlado. |
| `CustomerAddress` | Empresa/cuenta, etiqueta, destinatario, teléfono, dirección estructurada, ubigeo, referencia y estado/predeterminada. |
| `StorefrontSettings` | Uno por empresa; habilitación, visibilidad, registro, información pública, moneda/política de impuestos, versiones y parámetros comerciales. |
| `Product` | Visibilidad comercial desactivada por defecto, destacado y orden; descripción alternativa opcional. |
| `Cart` | Empresa/cuenta, estado, versión y fechas; un activo por cuenta/empresa. |
| `CartItem` | Carrito, producto, presentación, cantidad; restricción inicial de una presentación por producto. |
| `CheckoutQuote` | Empresa/cuenta/carrito, versión, selecciones/snapshots, importes, moneda, hash y vencimiento. |
| `StorePaymentMethod` | Métodos por empresa, instrucciones públicas, estados/compatibilidades y versión. |
| `StorePaymentIntegration` | Proveedor, comercio receptor, entorno y secretos cifrados; separado de instrucciones públicas. |
| `StoreShippingMethod` / `ShippingZone` | Modalidades, cobertura, tarifas, puntos de retiro y versiones. |
| `StoreOrder` | Empresa/cuenta/ficha, número, estados, moneda, totales, snapshots, idempotencia/fingerprint, vencimiento y `saleId` único. |
| `StoreOrderItem` | Producto/presentación y snapshots de nombre, precio, factor, cantidades base e impuestos. |
| `StockReservation` / `StockReservationAllocation` | Pedido, origen, producto/lotes, cantidades base, estado, expiración y timestamps de consumo/liberación. |
| Producto/lote | Agregados de reservas si se adopta ese diseño y constraints de cantidad no negativa. |
| `OrderPaymentAttempt` / `OrderPaymentProof` | Intentos, referencias y verificación de cobro; comprobantes manuales privados. |
| `OrderPaymentEvent` / `OrderRefund` | Dedupe de eventos y devoluciones verificables; identidad del comercio y referencia externa. |
| `OrderShipment` / `OrderStatusHistory` | Ejecución de entrega y trazabilidad de transiciones con actor/versión. |
| `StoreNotification` | Empresa/cuenta/pedido y contenido autorizado; buzón distinto del personal. |
| `RefreshToken` | Audiencia y cuenta comercial nullable para sesiones existentes; constraints y revocación por contexto. |
| `Sale` y publicación contable | Relación de pedido única y representación del cargo de envío; conservar compatibilidad con POS. |

### 13.1 Integridad en base de datos

- Mantener `companyId` en entidades tenant y validar propiedad en cada operación.
- Usar constraints compuestos donde una FK simple permita enlazar accidentalmente recursos de empresas distintas. Por ejemplo, cuenta/ficha, dirección/cuenta, pedido/cuenta y asignación de lote/producto deben demostrar misma empresa.
- Añadir las unicidades `[companyId, id]` necesarias para FKs compuestas; evitar suponer que un UUID/CUID garantiza pertenencia.
- Unicidad de número de pedido por empresa y de publicación de venta por pedido.
- Unicidad de idempotencia por cuenta/empresa y fingerprint obligatorio.
- Unicidad de pago externo por comercio/integración/proveedor.
- Carrito activo y dirección predeterminada: usar un diseño explícito, como índice parcial de PostgreSQL; documentarlo si Prisma no puede expresarlo directamente.
- Importes/cantidades con `Decimal`, rangos y redondeo definidos, consistentes con los campos existentes.
- Índices por empresa/cuenta/fecha, estado/vencimiento de reservas y eventos pendientes.
- Transiciones con versión/compare-and-set y verificación de filas afectadas.
- Evitar borrado físico en cascada de pedidos/pagos contables al cerrar una cuenta. Cierre, desactivación y anonimización se diseñan según la conservación necesaria del historial.

## 14. Backend y contratos API

### 14.1 Módulos sugeridos

```text
backend/src/modules/
  customer-accounts/   identidad comercial, perfil, vínculo con Customer
  storefront/          catálogo y configuración publicada
  shopping-carts/      carrito y cotización
  stock-reservations/  retención, liberación, consumo y conciliación
  store-orders/        pedidos y publicación de venta
  store-payments/      métodos, intentos, revisión, pasarela y devolución
  store-shipping/      cobertura, tarifa y entrega
```

Cada módulo mantiene controllers delgados, DTOs validados y servicios con inyección de dependencias. Evitar ciclos `orders ↔ payments ↔ sales`: utilizar interfaces/servicios transaccionales y eventos de dominio definidos.

### 14.2 API comercial propuesta

Prefijo ilustrativo `/store/:slug`; el prefijo global `/api` se mantiene.

| Método/ruta | Audiencia | Función |
| --- | --- | --- |
| `GET /store/:slug/info` | Pública y limitada | Empresa comercial, estado de tienda y opciones de acceso. |
| `POST /store/:slug/auth/register` | Pública | Iniciar alta en esa tienda. |
| `POST /store/:slug/auth/login` | Pública | Login de cliente en esa empresa. |
| `POST /store/:slug/auth/verify` | Token de verificación | Activar/vincular según flujo. |
| `POST /store/:slug/auth/forgot-password` | Pública, limitada | Recuperación genérica sin enumeración de cuentas. |
| `POST /store/:slug/auth/reset-password` | Token de recuperación | Cambio verificado. |
| `POST /store/:slug/auth/refresh` / `logout` | Sesión comercial | Renovación/cierre acotado. |
| `GET/PATCH /store/:slug/me` | Cliente propio | Perfil comercial. |
| `POST /store/:slug/me/password` | Cliente autenticado | Cambio de contraseña con confirmación. |
| `GET/POST/PATCH/DELETE /store/:slug/me/addresses[/id]` | Cliente propietario | Direcciones propias. |
| `GET /store/:slug/catalog` | Cliente activo | Catálogo paginado permitido. |
| `GET /store/:slug/catalog/:productId` | Cliente activo | Detalle comercial publicado. |
| `GET /store/:slug/categories` | Cliente activo | Categorías comerciales. |
| `GET /store/:slug/payment-methods` | Cliente activo | Instrucciones públicas; nunca secretos. |
| `GET /store/:slug/shipping-methods` | Cliente activo | Opciones comerciales; tarifa definitiva en cotización. |
| `GET /store/:slug/cart` | Cliente propietario | Carrito actual. |
| `POST/PATCH/DELETE /store/:slug/cart/items[/id]` | Cliente propietario | Líneas con control de versión. |
| `POST /store/:slug/checkout/quote` | Cliente propietario | Recalcular condiciones/totales. |
| `POST /store/:slug/orders` | Cliente propietario | Confirmar cotización idempotentemente. |
| `GET /store/:slug/orders[/id]` | Cliente propietario | Historial/detalle seguro. |
| `POST /store/:slug/orders/:id/cancel` | Cliente propietario, estado permitido | Solicitud o cancelación autorizada. |
| `POST /store/:slug/orders/:id/payments` | Cliente propietario | Crear/reutilizar intento de pago autorizado. |
| `POST /store/:slug/orders/:id/payment-proofs` | Cliente propietario | Adjuntar comprobante privado. |
| `GET /store/:slug/me/notifications` | Cliente propietario | Avisos comerciales propios. |

El webhook comercial usa una ruta pública dedicada, por ejemplo `/store-payments/webhooks/:provider/:integrationPublicId`, con resolución interna de integración y verificación. La empresa no se confía por venir en el payload/query.

### 14.3 API administrativa propuesta

`/store-admin/settings`, `/store-admin/products`, `/store-admin/customers`, `/store-admin/orders`, `/store-admin/payment-methods`, `/store-admin/shipping-methods`, `/store-admin/payments/:id/review`.

Solo audiencia STAFF con tenant y permisos comerciales concretos. La selección de recursos se vuelve a acotar al negocio del operador. No permitir que el administrador de una tienda cambie la contraseña global de un cliente o inspeccione sus cuentas en otras empresas.

### 14.4 Errores de dominio

Definir códigos estables para UX y pruebas: `STORE_DISABLED`, `PROFILE_INCOMPLETE`, `PRODUCT_UNAVAILABLE`, `PRICE_CHANGED`, `CART_VERSION_CONFLICT`, `QUOTE_EXPIRED`, `OUT_OF_STOCK`, `ADDRESS_OUT_OF_COVERAGE`, `PAYMENT_METHOD_UNAVAILABLE`, `ORDER_STATE_CONFLICT`, `RESERVATION_EXPIRED` e `IDEMPOTENCY_CONFLICT`.

Un recurso de otro cliente/empresa no se distingue de uno inexistente en respuestas de detalle. No devolver datos de contacto del propietario legítimo en errores.

## 15. Permisos y aislamiento

### 15.1 Matriz resumida

| Acción | Cliente final | Administrador de empresa | Manager autorizado | Cajero |
| --- | --- | --- | --- | --- |
| Ver catálogo publicado | Sí, de su tienda | Previsualización | Según permiso | No es necesario darle portal por su rol laboral. |
| Ver costos/stock interno | No | Permisos actuales | Permisos actuales | Permisos actuales, sin ampliación por tienda. |
| Perfil/direcciones comerciales | Solo propios | Gestión limitada de ficha en su empresa | Según permiso | Sin nuevo acceso general. |
| Carrito/checkout | Solo propios | No comprar en nombre de otro por defecto | No | No |
| Pedidos comerciales | Solo propios | Pedidos de su empresa | Según permiso | Solo entrega/cobro si se habilita expresamente. |
| Configurar tienda/pagos/envíos | No | Sí | Permisos delegados | No |
| Aprobar pago manual | No | Sí | Permiso específico | No por defecto. |
| Reembolsar | Solicitud, no aprobación | Permiso específico | Según delegación | No |
| Pagos/planes del SaaS | No | Capacidades actuales | Capacidades actuales | Capacidades actuales, sin nuevas concesiones. |
| Cambiar cuenta de otro negocio | No | No | No | No |

Permisos del portal sugeridos: `store:catalog:read`, `store:cart:manage_self`, `store:profile:manage_self`, `store:orders:read_self`, `store:orders:create`, `store:payments:create_self`.

Permisos laborales nuevos sugeridos: `store:settings:manage`, `store:catalog:manage`, `store:customers:manage`, `store:orders:read`, `store:orders:manage`, `store:payments:review`, `store:refunds:manage`, `store:shipping:manage`.

Ninguno de los permisos `_self` sustituye `customer:list`, `product:list`, `sale:list` o `company:update`.

### 15.2 Aislamiento obligatorio

- Tenant + cuenta propietaria en carrito, pedido, dirección, comprobante y aviso.
- Slug de empresa y contexto autenticado deben coincidir.
- No permitir elección de propietario en cuerpos DTO del comprador.
- No mezclar roles del personal y comprador en el token activo.
- Cookies distintas no sustituyen validar audiencia en el servidor.
- La navegación/proxy de Next.js es UX; la autorización real está en backend y consultas.
- Rate limits específicos para registro, login, recuperación, checkout, carga de comprobantes y reservas.
- No registrar DNI, contraseñas, tokens o comprobantes en logs. Trazar pedido, correlación y actor con identificadores internos.
- No reutilizar el buzón/SSE interno por `userId`: un mismo `User` podría recibir alertas laborales y comerciales. Proyectar avisos por cuenta/audiencia.

## 16. Navegación y frontend

### 16.1 Rutas propuestas

```text
/tienda/[empresaSlug]
  /ingresar
  /registro
  /verificar
  /recuperar
  /restablecer
  /catalogo
  /catalogo/[productoId]
  /carrito
  /pago
  /envio
  /perfil
  /direcciones
  /pedidos
  /pedidos/[pedidoId]
```

No se reutiliza `/checkout` global, que hoy participa del alta/pago de planes del SaaS.

Crear layout comercial independiente, por ejemplo `frontend/app/(store)/tienda/[empresaSlug]/...`, con secciones públicas y autenticadas diferenciadas. Evitar que herede `(dashboard)/layout.tsx`, que carga capacidades, datos de empresa y navegación del personal.

### 16.2 Menú del cliente

En escritorio: marca/contacto de la empresa, Catálogo, Carrito con contador, Mis pedidos, Métodos de pago/envío y Mi perfil.

En móvil: navegación compacta Catálogo / Carrito / Pedidos / Perfil; métodos y direcciones accesibles desde perfil y checkout.

Las pantallas de “métodos” informan y guardan preferencias. El flujo de compra incluye un resumen final explícito de productos, dirección, envío, impuestos y pago antes de confirmar.

### 16.3 Cambios transversales de interfaz

- Nuevo contrato `StoreSessionUser` o discriminación estricta por audiencia en sesión.
- Ruta de inicio comercial según cuenta y slug; no redirigir un comprador a `/dashboard`.
- Proxy y sesión de servidor conscientes de cookies/audiencias y de las rutas públicas de la tienda.
- API client comercial que no use el refresh laboral por accidente.
- Stores de carrito/cache separados por cuenta/empresa; el servidor conserva la verdad.
- Estados de carga, catálogo vacío, sin cobertura, producto retirado, recotización y pedido ya enviado.
- Accesibilidad de formularios, errores junto a campos, navegación de teclado y diseño móvil.
- Si se usa el escáner reciente para buscar productos, la consulta se hace al catálogo comercial, no al endpoint administrativo ni al enriquecimiento externo.

## 17. Eventos, notificaciones y operación

Eventos nuevos sugeridos:

- `STORE_ORDER_CREATED`.
- `STORE_PAYMENT_SUBMITTED`.
- `STORE_PAYMENT_CONFIRMED`.
- `STORE_ORDER_CANCELLED` / `STORE_ORDER_EXPIRED`.
- `STORE_ORDER_FULFILLMENT_CHANGED`.
- `STORE_REFUND_UPDATED`.

Los eventos se guardan con pedido/pago en la transacción y se despachan por outbox después. Una caída de email no debe revertir ni duplicar un pedido ya comprometido.

Para cambios repetidos usar dedupe por `tipo:pedidoId:version`, no solo `tipo:pedidoId`, porque un mismo pedido puede pasar por preparación, envío y entrega.

Destinatarios distintos:

- El cliente recibe datos de su pedido/cuenta en esa tienda.
- El personal autorizado recibe tareas operativas de su empresa.
- La plataforma recibe solo incidencias de integración que corresponda atender; no se convierte en receptor de los pagos de producto.

Métricas mínimas: pedidos creados/confirmados/vencidos, fallos de stock, reservas vencidas, conversión de carrito, tiempo de revisión, errores de pasarela, pagos pendientes de conciliación y entregas pendientes.

## 18. Pausa de tienda, planes y cupos

### 18.1 Capacidades del plan

Añadir capacidades específicas como `storefront`, `store.checkout`, `store.online_payments` y `store.delivery`, con denominaciones finales coherentes entre backend/frontend/seeds de planes.

El rol del cliente habilita acciones propias; el plan de la empresa habilita la existencia del servicio. Son controles diferentes.

Los clientes finales no consumen `maxUsers` ni `maxEmployees`. Definir un cupo comercial explícito si el producto lo necesita. También revisar `maxCustomers = maxProducts * 5`: un registro público no debe chocar inesperadamente con una fórmula pensada para el panel interno.

### 18.2 Estados de la empresa y obligaciones en curso

- Tienda pausada o plan no habilitado: impedir nuevos pedidos y, según política, nuevas altas/consulta del catálogo.
- No borrar clientes, pedidos ni pagos cuando se desactive una capacidad.
- Permitir acceso mínimo del comprador a su perfil, recuperación, pedidos existentes y comunicaciones pertinentes bajo una política específica.
- Continuar verificando pagos/webhooks pendientes y permitir conciliación/devolución de operaciones existentes.
- El `TenantGuard` laboral bloquea empresas en ciertos estados. No se debe debilitar globalmente para atender estos casos: diseñar un `StoreContextGuard` y operaciones acotadas de cierre/conciliación.
- La suspensión de un comprador impide nuevas operaciones; sus pedidos ya cobrados requieren resolución comercial, no desaparición.

## 19. Pruebas y criterios de aceptación globales

### 19.1 Identidad y fronteras

- Alta comercial no crea empresa, suscripción ni membresía laboral.
- Registro con correo existente no cambia contraseña ni toma control de una ficha.
- Cliente A1 no lee catálogo privado de B ni recursos de A2.
- Cliente con membresía laboral simultánea sigue sin acceder a endpoints internos desde su token STORE.
- Token STORE no sirve en `/payments`, `/companies`, `/products`, `/sales`, exportaciones, soporte interno o notificaciones del personal.
- Refresh, suspensión, cierre y recuperación mantienen contexto; no elevan roles.
- Cuotas laborales no aumentan al registrar compradores.

### 19.2 Catálogo y cálculo

- Ninguna respuesta comercial contiene costos, mínimos, stock reservado o notas internas.
- Productos no publicados/inactivos/eliminados y presentaciones inactivas no se pueden comprar adivinando su ID.
- Pruebas con más de una página de productos y filtros combinados.
- Cantidades enteras/fraccionarias, factores, límites, redondeo, impuestos incluidos/excluidos y envío.
- Cambio de precio/configuración/cobertura durante checkout exige nueva aceptación.
- Perfil incompleto y dirección de otro propietario se rechazan sin filtrar información.

### 19.3 Inventario y pedidos

- Pruebas contra PostgreSQL real para concurrencia, constraints y aislamiento, no solo mocks.
- Dos compradores y una venta POS compitiendo por la última unidad: nunca se venden más unidades que las disponibles.
- Transferencias/ajustes respetan reservas; no inmovilizan/descuentan dos veces.
- Hold por cantidad base, FEFO apto, vencimiento de lote y liberación concurrente.
- Expirar, cancelar, aprobar comprobante y recibir webhook a la vez conserva invariantes.
- Rollback al fallar línea, lote, kardex, auditoría transaccional o publicación de venta.
- Misma confirmación genera un pedido y la publicación genera una venta.

### 19.4 Pagos y entrega

- Imagen de comprobante no marca pago recibido; solo revisión autorizada lo hace.
- Firma inválida, beneficiario/importe/moneda equivocados y referencia de otro negocio no confirman.
- Repetición de webhook o revisión manual no duplica venta ni movimiento.
- Pago tardío con reserva vencida entra a conciliación definida.
- Selección de efectivo al recoger no registra cobro anticipado.
- Cambiar la dirección del perfil no cambia el envío histórico.
- Devolución y cancelación respetan si hubo cobro, entrega y salida física; no toda devolución de dinero implica reposición de stock.

### 19.5 Experiencia y despliegue

- E2E móvil/escritorio: registro → verificación → catálogo → carrito → cotización → pedido → pago → entrega.
- E2E con método manual y sandbox del PSP, además de recuperación de sesión.
- Regresión del POS, distribuidores, pagos del SaaS, reportes, notas de crédito, perfiles de vigencia y planes.
- Migraciones revisadas y ensayadas sobre copia de datos; datos iniciales de publicación desactivados.
- Piloto por una empresa, observación y habilitación gradual.

## 20. Decisiones a confirmar antes de ejecutar

El análisis puede implementarse con las propuestas anteriores, pero estas decisiones cambian alcance y prioridad:

| Decisión | Recomendación para empezar |
| --- | --- |
| ¿Catálogo privado o visible sin registro? | Privado, como exige el acceso por cuenta solicitado; portada pública mínima. |
| ¿El comprador puede tener cuenta en varias empresas? | Sí, cuentas comerciales separadas con identidad de acceso común. |
| ¿Autoservicio o invitación/aprobación? | Registro por tienda con email verificado; invitación para vincular fichas históricas. |
| ¿Todos los productos o selección? | Solo los explícitamente publicados. |
| ¿Cuándo pedir DNI/teléfono? | Antes de comprar; dirección solo si hay entrega. |
| ¿Qué fichas/historial del POS se pueden vincular? | Sin asociación automática por documento; validar titularidad y política de acceso. |
| ¿Qué medios de pago operará cada empresa? | Manuales al inicio; PSP cuando se disponga de credenciales/onboarding propio. |
| ¿Se aceptará efectivo contraentrega? | Solo al recoger inicialmente; entrega contra reembolso como ampliación. |
| ¿Quién aprueba y reembolsa pagos? | Admin y operadores con permisos comerciales separados. |
| ¿Precio incluye impuestos? | Acordar política concreta por empresa/producto antes de checkout. |
| ¿Cobertura y tarifa de envío? | Zonas/ubigeo y tarifa fija definida por el negocio, no cálculo libre del cliente. |
| ¿Varias presentaciones del mismo producto? | Una por producto en el MVP; rediseño de líneas si es un requisito inmediato. |
| ¿Pesos estimados o exactos? | Cantidad exacta solicitada al inicio; ajustes posteriores requieren otro flujo de cobro. |
| ¿Disponibilidad por sucursal? | Central al inicio; no prometer stock local sin un modelo por ubicación. |
| ¿Límites comerciales de clientes/pedidos? | Separados de licencias del personal y definidos en capacidades. |
| ¿Plazos de reserva/retiro? | Valores configurables y estados tardíos acordados con el negocio. |

## 21. Plan de implementación por fases

Las estimaciones son orientativas para un desarrollador full-stack con revisión y pruebas. Incluyen trabajo de integración, no tiempos de aprobación de proveedores, contenido comercial o validación del negocio. La suma orientativa es **40–63 días laborables**; se debe recalibrar al cerrar las decisiones anteriores.

Cada fase debe terminar con su migración compatible, pruebas, documentación y commit identificable. No se habilita una capacidad incompleta para compradores reales.

### Fase 1 — Base de cuentas comerciales y frontera de audiencias

**Dependencias:** aprobar decisiones de identidad, visibilidad y cupos. **Estimación:** 4–6 días.

Trabajo:

- Crear `CustomerAccount` y estados/rol comercial; relación segura con `User`, empresa y `Customer`.
- Definir permisos STORE y permisos administrativos de tienda.
- Diseñar/refactorizar el guard global para distinguir audiencias; sesión STORE denegada en rutas internas por defecto.
- Añadir audiencia/cuenta a refresh y contratos de sesión, con compatibilidad para sesiones existentes y rotación planificada.
- Excluir cuentas comerciales de cupos laborales y definir cupos/capacidades comerciales.
- Crear base de `StorefrontSettings` deshabilitada y flags de despliegue.

Entregable: infraestructura de comprador sin registro público habilitado todavía.

Criterio de salida: tokens de prueba STORE no acceden a ninguna ruta interna, incluyendo endpoints sin `@Roles`; las sesiones laborales y de plataforma mantienen sus flujos.

### Fase 2 — Registro, acceso, perfil y direcciones del cliente

**Dependencias:** Fase 1. **Estimación:** 4–6 días.

Trabajo:

- Alta/login por slug sin creación de empresa; verificación de email y recuperación segura.
- Correo transaccional configurado y entrega/reenvío durable sin activar cuentas cuando la verificación no se completa.
- Flujo de correo existente y vinculación comprobada de ficha histórica.
- Cookies/API client/sesión de servidor comerciales.
- Layout y navegación del portal; perfil, documento, teléfono y direcciones propias.
- Suspensión/cierre comercial por empresa y revocación de su sesión.
- Validaciones de propiedad, unicidad y datos personales.

Entregable: el cliente puede registrarse y gestionar su cuenta en la empresa.

Criterio de salida: dos empresas y dos clientes no comparten perfiles/direcciones; una identidad con ambos contextos no mezcla sesión ni datos.

### Fase 3 — Publicación y consulta del catálogo comercial

**Dependencias:** Fases 1 y 2. **Estimación:** 3–5 días.

Trabajo:

- Campos de publicación desactivados en productos existentes y administración de visibilidad.
- DTO/select comercial, paginación, categorías, imágenes y presentaciones activas.
- Catálogo y detalle móvil/escritorio con disponibilidad comercial.
- API y caches por empresa; contenido privado no indexable.
- Pruebas que inspeccionen la ausencia de costos y datos internos en respuestas.

Entregable: **MVP consultivo**: el cliente accede al catálogo publicado de su empresa.

Criterio de salida: solo productos publicados se consultan, no se exponen datos operativos y la empresa puede pausar/publicar sin modificar sus operaciones POS.

### Fase 4 — Configuración de pagos, envíos e impuestos comerciales

**Dependencias:** Fases 1–3. **Estimación:** 3–5 días.

Trabajo:

- Métodos de pago manuales y proyecciones públicas/administrativas separadas.
- Métodos de entrega, zonas, retiro, horarios y tarifas del negocio.
- Preferencias del cliente, con revalidación posterior.
- Política de impuestos y representación del componente de envío en totales/reportes.
- Matriz de compatibilidad pago/envío y estados de configuración.

Entregable: empresa configura sus opciones y el cliente puede consultarlas.

Criterio de salida: no se muestran credenciales, no se usan configuraciones SaaS como comerciales y cada dirección/método puede validarse en servidor.

### Fase 5 — Carrito persistente y cotización verificable

**Dependencias:** Fases 3 y 4. **Estimación:** 3–5 días.

Trabajo:

- `Cart`, líneas/versionado y sincronización por cuenta/empresa.
- Validación de unidades, presentaciones, límites y catálogo vigente.
- Pantallas de carrito/checkout y cotización persistida con vencimiento.
- Cálculo en servidor de productos, impuestos, envío y descuentos admitidos.
- UX para cambios de precio, agotados, direcciones y recotización.

Entregable: carrito y cotización, todavía sin comprometer cobro/stock.

Criterio de salida: manipular importes en el navegador no altera precios; cambios simultáneos no pisan el carrito y agregar productos no reduce existencias.

### Fase 6 — Reservas e inventario multicanal consistente

**Dependencias:** Fase 5 y política de stock/lotes aprobada. **Estimación:** 5–8 días.

Trabajo:

- Retención, asignación de lotes, consumo y liberación de reservas con TTL.
- Disponibilidad vendible y conciliación de stock heredado/lotes vencidos.
- Integración de reservas con POS, distribuidores y salidas/ajustes negativos.
- Bloqueos, restricciones de cantidades, reintentos y contadores conciliables.
- Barrido durable de vencimientos y límites de holds por cuenta.
- Pruebas concurrentes sobre PostgreSQL real.

Entregable: servicio compartido de stock que impide sobreventa entre canales.

Criterio de salida: última unidad compitiendo entre POS y compradores se asigna una sola vez; vencer/reintentar nunca fabrica stock ni descuenta dos veces.

### Fase 7 — Pedidos, pago manual y publicación de venta ONLINE

**Dependencias:** Fases 4–6. **Estimación:** 6–9 días.

Trabajo:

- Pedido/snapshots, máquina de estados, idempotencia y timeline.
- Confirmación de cotización con creación transaccional de pedido/reserva.
- Comprobantes privados y revisión de pago por operadores autorizados.
- Efectivo al recoger, si está habilitado, con cobro solo en la entrega.
- Servicio de publicación de ventas compartido con control de consumo de reserva, kardex y cargo de envío conciliable.
- Vista básica “Mis pedidos” y panel básico de pedidos/entregas de la empresa.
- Cancelación/vencimiento y tratamiento de pagos manuales tardíos.

Entregable: **MVP comercial manual** operable, incluyendo entrega/retiro básico y visibilidad de estado para el cliente.

Criterio de salida: un pedido aprobado produce una venta y una salida; un comprobante no aprobado no produce ingreso; POS/reportes conservan consistencia y se puede atender un pedido de principio a fin.

### Fase 8 — Pasarela online por empresa y conciliación

**Dependencias:** Fase 7, proveedor seleccionado y credenciales/onboarding de comercios. **Estimación:** 5–8 días.

Trabajo:

- Integraciones de pago por empresa y secretos cifrados.
- Creación idempotente de preferencia/intento fuera de transacciones de stock.
- Webhook verificado, consulta al proveedor y conciliación de beneficiario/importe/moneda.
- Estados duplicados/fuera de orden y cobros posteriores al vencimiento.
- Devoluciones y revisión operativa de incidencias de pago.
- Pruebas sandbox y separación comprobada de los cobros del SaaS.

Entregable: compra con cobro automatizado para tiendas expresamente configuradas.

Criterio de salida: retorno del navegador no confirma pagos; un evento falso o de otro comercio no afecta pedidos y un pago válido repetido genera un solo efecto contable.

### Fase 9 — Preparación, seguimiento y comunicaciones comerciales

**Dependencias:** Fase 7; Fase 8 para comunicaciones de pasarela. **Estimación:** 4–6 días.

Trabajo:

- Mejorar paneles de preparación, retiro, despacho y entrega sobre el flujo básico ya operable.
- Historial comercial, seguimiento y notificaciones por cuenta, no buzón interno de usuario.
- Outbox versionado para estados repetibles, email y preferencias comerciales.
- Reintentos, entregas fallidas, cambios autorizados y solicitudes de devolución.
- Indicadores operativos y conciliación de pedidos pendientes.

Entregable: experiencia completa de seguimiento y operación comercial.

Criterio de salida: cliente y negocio ven estados consistentes; fallar email no revierte ni duplica pedidos; la cuenta no recibe alertas laborales del mismo `User`.

### Fase 10 — Validación integral, piloto y despliegue gradual

**Dependencias:** fases necesarias para la modalidad comercial que se liberará. **Estimación:** 3–5 días.

Trabajo:

- Regresión de roles, planes, POS, distribuidores, pagos SaaS, reportes y devoluciones.
- E2E multitienda/multicuenta en móvil/escritorio y pruebas de concurrencia/recuperación.
- Ensayo de migraciones expand/contract, constraints y datos heredados.
- Capacitación de una empresa piloto: publicar, configurar, revisar pago y entregar.
- Monitorización, alertas de conciliación/reservas y procedimientos operativos.
- Documentación, despliegue por flags y criterios para ampliar empresas.

Entregable: lanzamiento controlado y verificable.

Criterio de salida: sin fugas de datos entre cuentas/empresas, sin sobreventa ni doble contabilización en pruebas; operación del piloto validada.

### 21.1 Dependencias y puntos de liberación

```text
F1 Base/audiencias → F2 Cuenta → F3 Catálogo
                                  └── MVP consultivo
                      F4 Métodos → F5 Carrito/cotización
                                      ↓
                               F6 Reservas multicanal
                                      ↓
                               F7 Pedidos/pago manual/venta
                                  └── MVP comercial manual
                                      ↓
                           F8 Pasarela + F9 Seguimiento
                                      ↓
                               F10 Piloto/despliegue
```

Las pruebas y controles de salida aplican desde Fase 1; la Fase 10 consolida y ensaya el lanzamiento, no pospone la autorización o las pruebas de stock hasta el final.

## 22. Migraciones, despliegue y reversibilidad

1. Cambios inicialmente aditivos: nuevas tablas, campos nullable y valores por defecto seguros.
2. Compradores, publicación y checkout deshabilitados hasta cumplir dependencias.
3. No crear cuentas de acceso a partir de todos los clientes actuales ni publicar todo el inventario en una migración.
4. Migración/rotación de sesiones compatible con personal y plataforma; documentar cuándo se exigirá reautenticación si cambia el formato.
5. Ensayar vínculos, documentos/correos duplicados históricos y reservas/inventario reconciliado en una copia antes de producción.
6. Aplicar migraciones, generar cliente Prisma y actualizar DTOs/tipos/permisos de forma coordinada con backend/frontend.
7. Habilitar primero una empresa, revisar respuestas reales, registros y conciliaciones; luego ampliar.
8. Si se pausa checkout, seguir atendiendo pagos y pedidos existentes. El rollback no elimina pedidos o reservas activas sin una transición de cierre definida.
9. Guardar guía operativa y pruebas de recuperación para caída del PSP, tareas de vencimiento, fallos de email y revisión manual.

## 23. Conclusión

La base actual permite desarrollar esta funcionalidad sin rehacer el sistema, pero el alcance es un **portal de venta por empresa**, no solo una pantalla adicional de productos.

La estrategia recomendada es: primero cuenta comercial y aislamiento; después catálogo privado; luego opciones comerciales, carrito y disponibilidad; finalmente pedidos/cobro/entrega integrados con la venta existente.

El primer paso de implementación recomendado es la **Fase 1**, porque determina qué significa `USUARIO_CLIENTE_FINAL` y garantiza que nunca se convierta accidentalmente en un usuario del panel interno.
