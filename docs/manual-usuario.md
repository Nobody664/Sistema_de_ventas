# Manual de Usuario — Huanka-SaaS

Guía completa de todos los módulos del sistema. Para cada módulo se explica **qué es**, **para qué sirve**, **cómo te beneficia**, y **cómo usarlo paso a paso**.

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Dashboard](#2-dashboard)
3. [Notificaciones](#3-notificaciones)
4. [Inventario](#4-inventario)
5. [Productos](#5-productos)
6. [Categorías](#6-categorías)
7. [Ventas (POS)](#7-ventas-pos)
8. [Cupones y descuentos](#8-cupones-y-descuentos)
9. [Clientes](#9-clientes)
10. [Distribuidores](#10-distribuidores)
11. [Salidas a distribuidores](#11-salidas-a-distribuidores)
12. [Proveedores](#12-proveedores)
13. [Órdenes de compra](#13-órdenes-de-compra)
14. [Entradas de stock / Compras](#14-entradas-de-stock--compras)
15. [Kardex y valorización](#15-kardex-y-valorización)
16. [Lotes y vencimientos](#16-lotes-y-vencimientos)
17. [Notas de crédito](#17-notas-de-crédito)
18. [Empleados](#18-empleados)
19. [Pagos y suscripción](#19-pagos-y-suscripción)
20. [Finanzas](#20-finanzas)
21. [Reportes](#21-reportes)
22. [Soporte](#22-soporte)
23. [Panel de Plataforma (Super Admin)](#23-panel-de-plataforma-super-admin)
24. [Roles y permisos](#24-roles-y-permisos)
25. [Preguntas frecuentes](#25-preguntas-frecuentes)

---

## 1. Primeros pasos

### Qué es
El sistema Huanka-SaaS es una plataforma de gestión de ventas e inventario multi-empresa. Cada empresa (tenant) ve solo sus propios datos.

### Cómo empezar
1. **Regístrate** en *Crear cuenta* (`/sign-up`). Quedarás como **COMPANY_ADMIN** de tu empresa.
2. Si la empresa requiere aprobación, un administrador de plataforma la revisará.
3. Al entrar verás el **Dashboard** y el menú lateral con los módulos habilitados según tu **plan**.
4. Configura tu empresa en **Perfil** (`/profile`) y revisa tu **Suscripción** (`/subscription`).

### Cómo te beneficia
Centralizas ventas, inventario, clientes, proveedores y contabilidad en un solo lugar, con acceso desde cualquier dispositivo.

> **Nota:** Los módulos visibles dependen de tu plan (ver [Roles y permisos](#24-roles-y-permisos)). Si no ves un módulo, puede que tu plan no lo incluya.

---

## 2. Dashboard

### Qué es
La pantalla de inicio con las métricas clave de tu negocio.

### Para qué sirve
- Ver ventas del período, número de transacciones, ticket promedio y tendencias.
- Identificar los **productos más vendidos** y los **mejores clientes**.
- Detectar productos con **stock bajo**.

### Cómo te beneficia
Tomas decisiones rápidas sin armar reportes: sabes cómo va el día, la semana o el mes de un vistazo.

### Cómo usarlo
1. Abre **Dashboard** en el menú principal.
2. Ajusta el rango de días y la granularidad (diaria/semanal/mensual).
3. Revisa los gráficos de serie, la comparativa contra el período anterior y la rotación.

> **Endpoint:** `GET /dashboard/metrics?days&granularity`.

---

## 3. Notificaciones

### Qué es
Centro de avisos del sistema, en tiempo real.

### Para qué sirve
- Alertas de **stock bajo** y **productos por vencer**.
- Avisos de **pagos**, **suscripción** (prueba por vencer, pago pendiente) y otros eventos.

### Cómo te beneficia
Nunca se te pasan cosas importantes: el sistema te avisa antes de que un producto se agote o venza, o cuando hay algo pendiente de pago.

### Cómo usarlo
1. Abre **Notificaciones**.
2. Las no leídas se resaltan; haz clic para marcarlas como leídas o usa **Marcar todo como leído**.
3. El ícono de campana muestra el contador de no leídas en vivo.

---

## 4. Inventario

### Qué es
El control central de existencias de todos tus productos.

### Para qué sirve
- Ver **movimientos** de inventario (entradas, salidas, ajustes).
- Conocer el **stock actual** por producto y por sucursal/almacén.
- Ver productos con **stock bajo** y hacer **ajustes** manuales.
- **Exportar** el inventario.

### Cómo te beneficia
Sabes siempre cuánto tienes, evitas quiebres de stock y corriges diferencias con trazabilidad.

### Cómo usarlo
1. **Ver movimientos:** abre **Inventario → Movimientos**.
2. **Stock bajo:** filtra por *Bajo stock*; el sistema sugiere reposición.
3. **Ajustar:** usa **Ajustes** para corregir cantidades (queda registrado en Kardex y auditoría).
4. **Sucursales:** administra almacenes en la sección de sucursales (`/inventory`).

### Sub-módulos relacionados
- **Sucursales/almacenes:** separa stock por local.
- **Reposición:** sugerencias de cuánto y cuándo reponer.
- **Pronóstico:** proyección de demanda a N días.

> **Endpoints:** `GET /inventory/movements`, `GET /inventory/low-stock`, `POST /inventory/adjustments`.

---

## 5. Productos

### Qué es
Tu catálogo de productos con precios, costos, presentaciones e imágenes.

### Para qué sirve
- Crear y editar productos (SKU, código de barras, precio, costo, stock mínimo).
- Manejar **presentaciones** (unidades, packs, cajas).
- Gestionar **categorías** y **proveedores** asociados.
- Buscar por **código de barras** y **exportar** el catálogo.

### Cómo te beneficia
Tener el catálogo ordenado acelera las ventas (búsqueda/escaneo), mejora el control de costos y alimenta reportes.

### Cómo usarlo
1. Abre **Productos**.
2. **Crear:** botón *Nuevo producto* → completa nombre, SKU, precio, costo, stock mínimo, categoría.
3. **Presentaciones:** dentro del producto, agrega unidades equivalentes (ej. caja = 12).
4. **Imagen:** sube una foto desde el detalle del producto.
5. **Exportar:** usa *Exportar* para descargar el catálogo.

> **Endpoint clave:** `GET /products/barcode/:code` (búsqueda por escáner).

---

## 6. Categorías

### Qué es
La organización jerárquica de tu catálogo.

### Para qué sirve
- Agrupar productos para reportes, navegación y búsquedas más rápidas.

### Cómo te beneficia
Encontrás y ordenás productos más rápido; los reportes se vuelven más claros por rubro.

### Cómo usarlo
1. Abre **Categorías**.
2. Crea categorías y subcategorías; asigna productos al editarlos.

---

## 7. Ventas (POS)

### Qué es
El punto de venta y el registro de todas las transacciones.

### Para qué sirve
- Registrar ventas (efectivo, tarjeta, Yape/Plin, etc.).
- Consultar el **listado y detalle** de ventas.
- **Cancelar** o **reembolsar** una venta.
- **Exportar** ventas.
- Asociar la venta a un **cliente** y aplicar **descuentos/cupones**.

### Cómo te beneficia
Vender es rápido (escaneo/búsqueda), el **stock se descuenta automáticamente**, se registra en Kardex y se generan alertas de stock bajo. Los reembolsos revierten el inventario y pueden originar notas de crédito.

### Cómo usarlo
1. Abre **Ventas**.
2. Agrega productos (escaneando o buscando), ajusta cantidades y selecciona cliente (opcional).
3. Aplica cupón si corresponde y elige método de pago.
4. Confirma la venta. Desde el detalle puedes **cancelar** o **reembolsar**.

> **Comprobantes:** imprime boleta/factura desde el detalle de venta (usa las plantillas configuradas).

---

## 8. Cupones y descuentos

### Qué es
Códigos promocionales y reglas de descuento.

### Para qué sirve
- Crear cupones (por porcentaje, monto fijo, vigencia, usos máximos).
- **Validar** un cupón antes de aplicarlo en la venta.

### Cómo te beneficia
Ejecutas promociones y campañas sin descontar de más, con control de vigencia y límites.

### Cómo usarlo
1. Abre **Cupones**.
2. Crea un cupón definiendo tipo, valor, fechas y tope de usos.
3. En Ventas, ingrésalo en el campo de cupón (se valida automáticamente).

---

## 9. Clientes

### Qué es
El directorio de tus compradores.

### Para qué sirve
- Registrar clientes (nombre, documento/DNI-RUC, contacto).
- Ver **historial de compras** por cliente.
- **Exportar** la lista de clientes.
- Autocompletar datos por **DNI/RUC** (consulta RENIEC/SUNAT, según plan).

### Cómo te beneficia
Fidelizas y conoces a tus clientes, agilizas el registro con autocompletado y cumples con datos fiscales.

### Cómo usarlo
1. Abre **Clientes**.
2. **Crear:** *Nuevo cliente*. Escanea o busca por documento para autocompletar.
3. Haz clic en un cliente para ver su historial de compras.

> **Nota:** La consulta DNI/RUC consume cuota según tu plan y tiene límite de velocidad.

---

## 10. Distribuidores

### Qué es
Personas o negocios a quienes **tú les vendes o consignas** mercadería (reventa, consignación, fuerza de ventas). Representan el extremo **de salida** de tu cadena de suministro.

### Para qué sirve
- Registrar distribuidores y asignarles productos.
- **Transferir** (entregar en consignación) y registrar **retornos**.
- Registrar **ventas** que el distribuidor hace y sus **entregas**.
- Ver el **saldo/deuda** por distribuidor y hacer **liquidaciones**.

### Cómo te beneficia
Controlas la mercadería que está fuera de tu almacén, sabes cuánto te debe cada distribuidor y liquidas la consignación con precisión. Cada movimiento actualiza stock, Kardex y saldos.

### Cómo usarlo
1. Abre **Distribuidores**.
2. **Crear:** agrega el distribuidor y asígnale productos.
3. **Transferir:** usa *Transferencia* para entregarle stock (o *Salidas a distribuidores*, ver sección 11).
4. **Venta/Entrega:** registra lo que vendió y lo que entregó.
5. **Liquidar:** registra el **settlement** para cerrar la cuenta del período.

> **Distribuidor vs Proveedor:** el **distribuidor** te **compra/recibe** de ti (salida); el **proveedor** te **vende** a ti (entrada). No son lo mismo.

---

## 11. Salidas a distribuidores

### Qué es
Un flujo simplificado para registrar **entregas/consignaciones** a distribuidores.

### Para qué sirve
- Sacar productos del almacén hacia un distribuidor de forma guiada.
- Dejar historial de cada salida con su destino.

### Cómo te beneficia
Es la vía rápida para despachar consignación sin entrar al detalle completo del distribuidor. Reutiliza la misma lógica segura de transferencia (descuenta stock, reserva lotes, actualiza saldo y Kardex).

### Cómo usarlo
1. Abre **Salidas a distribuidores**.
2. Elige el **distribuidor** (solo los activos).
3. Agrega **productos y cantidades** y, si quieres, una nota.
4. Confirma; verás la salida en el **historial** con enlace al distribuidor.

---

## 12. Proveedores

### Qué es
Los negocios que te **venden** mercadería a ti. Extremo **de entrada** de tu cadena de suministro. (Pista en el menú: *"De quién compras"*).

### Para qué sirve
- Registrar proveedores con sus datos de contacto.
- Asociar **productos** a cada proveedor.
- Gestionar **órdenes de compra** y su recepción.
- Generar **auto-órdenes** desde productos con stock bajo.

### Cómo te beneficia
Compras de forma ordenada, comparas proveedores, y repones automáticamente lo que se está agotando. Al recibir una orden, el stock entra solo.

### Cómo usarlo
1. Abre **Proveedores**.
2. **Crear:** *Nuevo proveedor* con datos de contacto.
3. Asóciale **productos** desde su detalle.
4. Crea órdenes de compra (sección 13) o usa **auto-órdenes**.

---

## 13. Órdenes de compra

### Qué es
Documentos que registran qué vas a comprar y a quién.

### Para qué sirve
- Crear órdenes con productos y cantidades.
- Cambiar su **estado** (pendiente, aprobada, recibida, anulada).
- **Recibir** la orden → genera una **entrada de stock** automática.
- **Auto-órdenes:** sugerencias generadas a partir de productos con stock ≤ mínimo.

### Cómo te beneficia
Formalizas la compra, evitas olvidos y conviertes la recepción en stock real con un clic, todo trazado en Kardex.

### Cómo usarlo
1. Abre **Órdenes de compra**.
2. **Crear:** elige proveedor, agrega productos y cantidades.
3. Actualiza el estado según avance.
4. Al llegar la mercadería, pulsa **Recibir** para cargar el stock.

> **Auto-órdenes:** usa *Previsualizar* para revisar sugerencias antes de *Generar*.

---

## 14. Entradas de stock / Compras

### Qué es
El registro de todo lo que **ingresa** a tu almacén (compras, recepciones).

### Para qué sirve
- Registrar entradas de productos con costo y proveedor.
- Agrupar compras **por proveedor** y emitir **boletas/recepciones** (comprobantes).
- Ver el detalle de cada recepción.

### Cómo te beneficia
Aumenta tu stock de forma trazable, alimenta el Kardex y te da comprobantes de lo recibido. Todo queda asociado al **proveedor** correcto.

### Cómo usarlo
1. Abre **Inventario → Entradas**.
2. **Nueva entrada:** elige **Proveedor** (o "General"), agrega productos y cantidades con su costo.
3. Confirma; el stock sube y se registra en Kardex.
4. **Boleta/Recepción:** agrupa entradas y emite el comprobante (imprimible).

---

## 15. Kardex y valorización

### Qué es
La tarjeta de control de cada producto: entradas, salidas y **saldo valorizado**.

### Para qué sirve
- Ver el historial completo de movimientos por producto.
- Calcular **costo de ventas** y **valor de inventario** (métodos: PEPS/FIFO, UEPS/LIFO, Promedio, PMP).
- Analizar **rentabilidad** por producto.

### Cómo te beneficia
Conoces el valor real de tu inventario, el costo de lo vendido y qué productos son más rentables.

### Cómo usarlo
1. Abre **Kardex** (dentro de Inventario).
2. Filtra por producto y rango de fechas.
3. Revisa movimientos, saldos y valorización; consulta **Resumen** y **Rentabilidad**.

> **Requiere** plan con *inventory.kardex*.

---

## 16. Lotes y vencimientos

### Qué es
Control de **lotes/series**, cantidades y **fechas de vencimiento**.

### Para qué sirve
- Registrar lotes al ingresar mercadería.
- Ver productos **por vencer** (ej. próximos 7 días).
- **Reservar** cantidades de un lote.

### Cómo te beneficia
Evitas vender productos vencidos, reduces mermas y priorizas lo que está por caducar. Hay alertas automáticas diarias.

### Cómo usarlo
1. Al crear una entrada, asigna lote y fecha de vencimiento.
2. Consulta **Por vencer** para anticiparte.
3. Usa **Reservar** para apartar stock de un lote.

> **Requiere** *inventory.batches*. Alertas diarias por cron.

---

## 17. Notas de crédito

### Qué es
Documentos que registran devoluciones, ajustes o créditos a favor del cliente.

### Para qué sirve
- Emitir notas de crédito vinculadas a una venta.
- Cambiar su **estado**.

### Cómo te beneficia
Documentas devoluciones y ajustes correctamente; suelen generarse automáticamente al **reembolsar** una venta.

### Cómo usarlo
1. Abre **Notas de crédito**.
2. **Crear:** asóciala a la venta y detalla el motivo.
3. Actualiza el estado cuando se apruebe/procese.

---

## 18. Empleados

### Qué es
La gestión de tu equipo y sus accesos.

### Para qué sirve
- Crear/editar empleados y asignarles **rol** (Manager, Cajero, etc.).
- Ver **límites** de empleados según tu plan.

### Cómo te beneficia
Cada colaborador accede solo a lo que le corresponde, con permisos por rol y trazabilidad.

### Cómo usarlo
1. Abre **Empleados**.
2. **Crear:** datos y rol del empleado.
3. Edita o desactiva cuando sea necesario.

> **Requiere** módulo *employees* y respeta el límite de tu plan.

---

## 19. Pagos y suscripción

### Qué es
La administración de tu **plan** y los pagos asociados.

### Para qué sirve
- Ver tu **suscripción** actual y su estado (prueba, activa, vencida).
- **Mejorar de plan** (upgrade) o cancelar.
- Subir **comprobantes de pago** (Yape, Plin, transferencia) o pagar con **MercadoPago**.
- Consultar el **historial de pagos** y descargar **recibos**.

### Cómo te beneficia
Sabes qué plan tienes, cuándo vence y cómo pagar; desbloqueas módulos al subir de plan.

### Cómo usarlo
1. Abre **Pagos** (o **Suscripción**).
2. Revisa el estado y pendientes.
3. Para mejorar: elige plan → paga o sube comprobante → queda en revisión.
4. Descarga recibos desde el historial.

> **Plataformas:** MercadoPago (webhook en línea) y proveedores offline (Yape/Plin/transferencia con voucher).

---

## 20. Finanzas

### Qué es
El registro de **ingresos y gastos** de tu empresa.

### Para qué sirve
- Registrar movimientos financieros con categoría y fecha.
- Ver un **resumen** (ingresos vs gastos, balance).

### Cómo te beneficia
Llevas la salud financiera del negocio más allá de las ventas por producto.

### Cómo usarlo
1. Abre **Finanzas**.
2. **Nuevo registro:** tipo (ingreso/gasto), monto, categoría, descripción.
3. Consulta el **Resumen** para ver el balance del período.

> **Solo COMPANY_ADMIN.**

---

## 21. Reportes

### Qué es
Informes del negocio listos para analizar o compartir (PDF/Excel).

### Para qué sirve
- Reporte de **ventas** (overview): métricas, top productos, tendencias.
- Reportes de **inventario** y **clientes** exportables.

### Cómo te beneficia
Obtienes una vista consolidada para tomar decisiones y entregar información a terceros.

### Cómo usarlo
1. Abre **Reportes**.
2. Elige el tipo y el rango; descarga en PDF o Excel.

> **Requiere** plan con *reports.basic*.

---

## 22. Soporte

### Qué es
Tu canal de ayuda con el equipo de la plataforma.

### Para qué sirve
- Crear y seguir **tickets** de soporte.
- Consultar **FAQs** y **chatear** en vivo.
- Convertir una conversación en ticket.

### Cómo te beneficia
Resuelves dudas y problemas rápido, con historial y seguimiento.

### Cómo usarlo
1. Abre **Soporte**.
2. Crea un **ticket** describiendo el problema.
3. Sigue la conversación; agrega comentarios y ciérralo cuando se resuelva.
4. Explora **FAQs** o usa el **chat** para ayuda inmediata.

---

## 23. Panel de Plataforma (Super Admin)

Panel global reservado a **SUPER_ADMIN / SUPPORT_ADMIN**. Se accede con *Ir a Plataforma* (`/platform`).

| Sección | Qué hace |
|---|---|
| **Resumen** | Métricas globales: empresas, suscriptores, tickets, MRR. |
| **Empresas** | Crear, aprobar/rechazar, activar/suspender empresas y asignar planes. |
| **Suscriptores** | Listar y aprobar/rechazar suscripciones; ver estadísticas. |
| **Solicitudes** | Revisar solicitudes de **upgrade** y **checkout** con comprobante. |
| **Planes** | Crear/editar planes (`/platform/plans`). |
| **Plantillas de Boletas** | Diseñar plantillas de boleta/factura (térmica/A4). |
| **Pagos globales** | Configurar pasarelas y revisar comprobantes pendientes. |
| **Auditoría** | Ver el registro de acciones de toda la plataforma. |

### Para qué sirve / beneficio
Opera y monitorea todo el SaaS: alta de clientes, facturación, configuración de pagos y auditoría global.

---

## 24. Roles y permisos

| Rol | Alcance |
|---|---|
| **SUPER_ADMIN** | Todo el sistema y la plataforma. |
| **SUPPORT_ADMIN** | Soporte y consulta de la plataforma. |
| **COMPANY_ADMIN** | Administra por completo su empresa. |
| **MANAGER** | Gestión operativa (inventario, ventas, compras). |
| **CASHIER** | Vende y registra clientes; acceso limitado. |
| **VIEWER** | Solo lectura (reportes/dashboard). |

**Módulos por plan:** además del rol, cada usuario ve solo los módulos incluidos en el plan de su empresa. Si falta uno, revisa tu **suscripción** o solicita un **upgrade**.

---

## 25. Preguntas frecuentes

**¿Por qué no veo un módulo?**
Puede que tu rol no lo permita o que tu plan no lo incluya. Revisa tu suscripción.

**¿Distribuidor y proveedor son lo mismo?**
No. El **distribuidor** te compra/recibe de ti (salida); el **proveedor** te vende a ti (entrada).

**¿Las ventas descuentan stock solas?**
Sí. Cada venta descuenta inventario, registra Kardex y puede generar alertas de stock bajo.

**¿Cómo repongo productos agotados?**
Usa **Auto-órdenes** en Órdenes de compra, que se generan desde productos con stock ≤ mínimo.

**¿Cómo pago mi plan?**
Desde **Pagos**: MercadoPago o subiendo comprobante (Yape/Plin/transferencia) para revisión.

**¿Cómo controlo productos que vencen?**
Con **Lotes y vencimientos**; el sistema avisa automáticamente de los próximos a vencer.

---

*Documento generado para el proyecto Huanka-SaaS (Sistema de Ventas). Última actualización: 2026.*
