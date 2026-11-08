# Diseño UI/UX integrado del Centro de tienda

Ver [arquitectura](README.md), [datos](modelo-datos.md) y [prototipo navegable](prototipo-panel.html).

## 1. Dirección visual

**Concepto: un estudio de operaciones de la tienda.** Fondo crema, verde petróleo, superficies limpias, jerarquía editorial y controles compactos. Las decisiones comerciales son protagonistas; los gráficos acompañan.

Problemas del diseño actual que se eliminan:

1. Demasiadas funciones en una página de desplazamiento largo.
2. Integración de pagos mezclada con la atención diaria de pedidos.
3. Acciones genéricas siempre visibles aunque el pedido no permita ejecutarlas.
4. Falta de detalle enlazable y filtros persistentes al volver de un pedido.
5. Dashboard inexistente: las tareas pendientes no tienen prioridad visual.

### Sistema visual compartido

| Token      | Claro     | Oscuro                              |
| ---------- | --------- | ----------------------------------- |
| Fondo      | `#f6f4ef` | `#0b1220`                           |
| Superficie | `#ffffff` | `#111c2c`                           |
| Texto      | `#202924` | `#f0f5f2`                           |
| Secundario | `#5d6964` | `#b5c4c2`                           |
| Acento     | `#134e4a` | `#5eead4` para énfasis sobre oscuro |
| Bordes     | `#dce0d8` | `#344352`                           |

Reutilizar las fuentes del proyecto: Bricolage Grotesque para titulares e IBM Plex Sans para lectura. El workspace puede tener tokens `--commerce-*` derivados de los de tienda, sin cambiar el tema de Gestión de ventas.

Espaciado base 4/8 px, paneles con 20–28 px de relleno, radios 12 px en controles y 16–20 px en contenedores. Objetivos táctiles de 44 px y texto de formulario ≥ 14 px. Contraste WCAG AA, foco visible y estados que no dependan solo del color.

## 2. Arquitectura de información

```text
Selector de módulo: Gestión de ventas / Centro de tienda

OPERACIÓN
  Resumen
  Pedidos
  Pagos
  Entregas

TIENDA
  Catálogo
  Clientes
  Apariencia

CONFIGURACIÓN
  Formas de pago
  Formas de entrega
  Reglas de compra

Pie del menú
  Abrir tienda del cliente
  Volver al sistema
```

El menú se filtra por contexto/permisos. En modo de atención restringida, muestra únicamente funciones históricas permitidas y una explicación de la restricción. Un elemento oculto en el menú no sustituye la autorización del servidor.

### Esqueleto de pantalla

```text
┌──────────────────────┬─────────────────────────────────────────────────────┐
│ CENTRO DE TIENDA      │ Tienda de ejemplo        Buscar pedido   Avisos  Yo │
│ Negocio de ejemplo    ├─────────────────────────────────────────────────────┤
│                      │ Resumen                      Período  Abrir tienda  │
│ Resumen              │ Lo que necesita tu atención                         │
│ Pedidos          8   │                                                     │
│ Pagos            3   │ [Pedidos] [Ventas vigentes] [Pagos por revisar]      │
│ Entregas         5   │                                                     │
│ ──────────────       │ Cola prioritaria                    Actividad       │
│ Catálogo             │ Pedido / pago / entrega / antigüedad Historial      │
│ Clientes             │                                                     │
│ Apariencia           │ Tendencia del período / bloque secundario           │
│ Configuración        │                                                     │
│                      │ Última actualización / reconexión                    │
│ Volver al sistema    │                                                     │
└──────────────────────┴─────────────────────────────────────────────────────┘
```

Topbar de 64–72 px; sidebar de unos 240 px. A 768 px se convierte en drawer; a 320/390 px las vistas usan listas legibles y acciones al alcance, no una tabla de escritorio encogida.

## 3. Catálogo de pantallas

| Pantalla          | Propósito principal                | Componentes                                         | Acción principal                        |
| ----------------- | ---------------------------------- | --------------------------------------------------- | --------------------------------------- |
| Resumen           | Decidir la siguiente tarea         | KPIs definidos, pendientes, actividad, rango        | Atender pendientes                      |
| Pedidos           | Encontrar y operar compras         | Filtros, búsqueda por número, lista/tablero, vistas | Abrir pedido                            |
| Detalle de pedido | Resolver una compra con contexto   | Resumen, pago, entrega, historial, notas internas   | Siguiente comando permitido             |
| Pagos             | Revisar comprobantes e incidencias | Bandeja de revisión, visor privado, conciliación    | Registrar cobro verificado              |
| Entregas          | Preparar y despachar               | Grupos por retiro/delivery/estado, referencia       | Preparar / listo / despachar / entregar |
| Catálogo          | Elegir qué ve el comprador         | Fotos, búsqueda, categorías, estado de publicación  | Publicar selección                      |
| Clientes          | Consultar cuentas del negocio      | Lista, actividad comercial y estado                 | Abrir ficha                             |
| Apariencia        | Diseñar antes de publicar          | Editor, vista previa móvil/escritorio, borrador     | Publicar versión revisada               |
| Formas de pago    | Definir opciones del checkout      | Métodos ordenables e instrucciones                  | Guardar método                          |
| Formas de entrega | Definir retiro y cobertura         | Lista de métodos, tarifa, ubigeos, dirección        | Guardar entrega                         |
| Reglas            | Controlar el funcionamiento        | Checkout/registro, impuestos, reserva               | Guardar reglas                          |

## 4. Resumen: pocas métricas y contexto

- Encabezado con nombre de tienda, estado operativo y período.
- Tres o cuatro cifras como máximo en la primera fila, con definición accesible en ayuda.
- Cola prioritaria como bloque más grande: comprobantes por revisar, pagos tardíos en revisión y reservas cercanas a vencer.
- Las alertas de preparación no compiten con una serie de gráficos decorativos.
- Si faltan configuración/publicación, mostrar una guía de inicio con pasos reales: productos, pago, entrega y checkout. No declarar “lista para vender” si alguno falta.
- Primera carga: skeleton de tamaño estable por bloque; error de gráfico aislado, sin bloquear los pedidos.
- Sin datos: explicar qué hecho genera la métrica. No mostrar crecimiento porcentual inventado ni confundir ausencia de datos con un error de API.

No se llama “ingresos” al total de pedidos pendientes. Usar las definiciones de métricas de [arquitectura](README.md#7-definición-del-dashboard).

## 5. Pedidos: tabla, tablero y detalle

### Bandeja

```text
Pedidos
[Buscar por número] [Período] [Pago] [Entrega] [Restablecer]
[Todos] [Por revisar] [Preparación] [Listos / en ruta]

[Lista | Tablero]                         [Columnas] [Guardar vista]

Número      Cliente      Pedido       Pago        Entrega      Total
WEB-…       A. Ejemplo   Confirmado   Pagado      Preparando    S/ …
```

- Filtros seguros en la URL; volver desde el detalle conserva los filtros y la posición cuando sea posible.
- Búsqueda primaria por número de pedido. No introducir DNI/email en URLs compartibles ni vistas guardadas.
- Elegir la vista no dispara una mutación ni modifica el estado del pedido.
- Paginación del servidor y orden estable. El total se obtiene del backend, nunca de la página visible.
- Actualizaciones SSE invalidan las consultas; si se está editando una acción, avisar del cambio de versión sin sobrescribir el formulario.

### Tablero

El tablero representa **colas derivadas**, no un nuevo enum de estados:

| Columna         | Criterio de presentación                                                     |
| --------------- | ---------------------------------------------------------------------------- |
| Por revisar     | `paymentStatus=UNDER_REVIEW` o `status=REVIEW_REQUIRED`                      |
| Por preparar    | No terminal, `UNFULFILLED`, cobrado o retiro en efectivo con reserva vigente |
| En preparación  | `fulfillment=PREPARING`, no terminal                                         |
| Listo / en ruta | `READY_FOR_PICKUP` o `SHIPPED`, no terminal                                  |

Un pedido en revisión tiene prioridad sobre las otras colas para evitar duplicarlo en columnas. Pagos pendientes sin comprobante se consultan en su filtro; cancelados, expirados y completados se consultan en histórico.

**MVP sin drag-and-drop de estados.** Mover una tarjeta no puede confirmar un pago, devolver dinero o saltar una transición. Las tarjetas abren el detalle y sus comandos permitidos. Si después se añade arrastre, solo propondrá un comando de entrega autorizado y ofrecerá alternativa completa por teclado.

### Detalle enlazable

```text
← Pedidos / WEB-…                         [Siguiente acción válida]
Pedido: confirmado    Pago: pagado    Entrega: preparando

Productos y total                        Cliente / entrega
Cantidades, presentación                 Dirección o retiro
Impuesto y envío                         Contacto autorizado

Pago y comprobantes                      Notas internas [solo equipo]
Referencia / proveedor                   Añadir nota

Línea de tiempo comercial
Creado → cobro confirmado → preparando → entregado
```

Ruta real como primera entrega; drawer de detalle sobre listado es una mejora posterior, preservando siempre el enlace canónico. Separar estado del pedido, del pago y de la entrega; usar nombres comprensibles y textos de ayuda.

El contenido de notas internas nunca se reutiliza en la línea de tiempo del cliente. Ver un comprobante no lo aprueba; la confirmación debe pedir la referencia requerida por el servidor.

## 6. Pago y entrega: comandos con condiciones reales

| Acción                   | Condición que debe explicar la UI                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Registrar cobro manual   | Método no Mercado Pago, referencia real de longitud válida y verificación externa realizada |
| Corregir comprobante     | Solo cuando el pago está en revisión                                                        |
| Preparar                 | Pagado; excepción actual: retiro en efectivo dentro de reserva vigente                      |
| Listo para retirar       | Pedido en preparación y método `PICKUP`                                                     |
| Despachar                | Preparación, método `DELIVERY` y referencia/seguimiento                                     |
| Entregar                 | Listo o despachado y cobro confirmado, incluido efectivo al retirar                         |
| Cancelar                 | Impago sin venta publicada; pagado requiere devolución                                      |
| Devolver pago            | Flujo de devolución total y confirmación del proveedor/cobro según corresponda              |
| Registrar retorno físico | Operación distinta del reembolso, según validación del servicio                             |

`allowedActions` se calculará en el servidor para orientar la interfaz; el comando vuelve a validar las condiciones. Nunca representar el mismo botón para todas las filas esperando que el usuario descubra sus restricciones con errores.

El MVP respeta los estados actuales: no inventa un pago contra entrega distinto de `CASH_ON_PICKUP`, ni cambia la moneda o el PSP soportado.

## 7. Configuración de entrega

- Lista visible con nombre, tipo, tarifa, dirección/cobertura y estado habilitado.
- Editor condicional: retiro exige dirección; delivery exige al menos un ubigeo válido. Campos no aplicables no se envían como el texto `undefined`.
- Selector de ubigeo por departamento/provincia/distrito cuando se integre un catálogo de referencia; hasta entonces explicar el código de seis dígitos.
- Orden visual configurable si se añade `sortOrder`; guardar ese orden en el servidor, no solo en el navegador.
- Vista previa de cómo aparecerá el método en el checkout del cliente.
- Un método deshabilitado deja de ofrecerse a compras nuevas; pedidos históricos conservan el snapshot de su entrega.
- La selección activa de entrega y dirección forma parte de la cotización. Al cambiarla se invalida el total anterior; el panel no puede modificar retrospectivamente un snapshot aceptado.

## 8. Catálogo administrativo y clientes

### Catálogo

Vista lista para operación masiva y galería para inspeccionar imágenes; nombre, presentación, precio, estado activo y publicación sin mezclar costos con la vista previa pública. Mantener “disponibilidad comercial” separada de editar inventario.

Publicación individual inmediata con reversión visual ante error. Acciones masivas posteriores con selección explícita, máximo acotado y resultado por producto. No publicar todos los productos automáticamente al abrir el módulo.

### Clientes

El listado muestra solo datos necesarios: nombre, cuenta activa/suspendida, fecha de alta y acceso al detalle. No mostrar DNI completo ni dirección en cada tarjeta. Suspender una cuenta comercial no desactiva al usuario global ni sus cuentas de otras tiendas.

La ficha enlaza compras del cliente de esa compañía. No agrega en silencio su historial de otros negocios por compartir el mismo `User`.

## 9. Apariencia y vista previa

- Editor a la izquierda, preview a la derecha; alternancia móvil/escritorio.
- Secciones limitadas: logo, portada, titular, descripción y visibilidad del teléfono comercial.
- Paleta conservada; presets acotados y tokens contrastados. Sin editor de HTML/CSS libre.
- Guardar borrador es distinto de publicar. Mostrar versión y fecha de última publicación.
- Preview accesible solo con sesión laboral; no publicar borradores mediante una URL compartida sin control.
- Publicar valida medios, versión y pertenencia a la compañía. Un error deja publicada la versión anterior.
- El nombre del navegador y la cabecera usan la identidad comercial canónica; la URL conserva el slug.

## 10. Formularios y sistema de feedback

- Reutilizar y evolucionar `StoreField`, esquemas cliente y DTOs de servidor; no reimplementar límites distintos por pantalla.
- Etiqueta visible, ayuda breve y error junto al campo; foco al primer error después del envío.
- Validar al salir de un campo y al enviar, sin alertas intrusivas en cada pulsación.
- Conservar datos ante error; bloquear doble envío y mostrar resultado de la mutación.
- Formularios de cobro y devolución: importe/moneda/pedido de contexto no editables y referencia/motivo cuando aplica.
- Manejar 409 mediante recarga del estado y explicación de versión; no repetir un comando financiero automáticamente.
- Secretos de integración: entrada nueva con estado “configurada”, nunca devolver el token guardado ni rellenar campos con texto cifrado.
- Cambios visuales pueden previsualizarse localmente; las operaciones financieras solo muestran éxito después de confirmación del servidor.
- Evitar toasts como única información de un fallo: error junto al formulario y vínculo para recuperar el pedido cuando se perdió una respuesta.

## 11. Responsive, accesibilidad y movimiento

| Ancho        | Comportamiento                                                                 |
| ------------ | ------------------------------------------------------------------------------ |
| 320/390 px   | Menú en drawer, KPIs apilados, tarjetas de pedido, detalle a pantalla completa |
| 768 px       | Menú compacto, dos columnas cuando el contenido lo permite                     |
| 1024/1440 px | Sidebar persistente, bandeja y panel auxiliar, preview en dos columnas         |

Navegación por teclado, botones semánticos, nombre accesible de iconos, foco gestionado en diálogos y retorno al elemento que los abrió. Formularios y tablas legibles con zoom al 200 %. `prefers-reduced-motion` elimina transiciones no esenciales.

Microinteracciones: estado de carga localizado, selección de fila clara, actualización discreta de contadores y cambio de vista. No usar animaciones permanentes, paneles flotantes decorativos o gráficos que compitan con el trabajo principal.

## 12. Prototipo y límites

El [HTML de demostración](prototipo-panel.html) permite cambiar de sección, alternar lista/tablero, filtrar pedidos, abrir detalle y previsualizar un nombre de tienda. Usa datos ficticios y no ejecuta pagos, cambios de estado ni llamadas al sistema.

Es una referencia de composición e interacción, no una segunda aplicación ni la implementación del modelo de permisos. La implementación debe usar los componentes y proveedores reales de Next.js, las guardas del backend y los contratos propuestos en los demás documentos.
