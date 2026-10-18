# Área: Ventas (POS)

Punto de venta y consulta de ventas: registro de transacciones (canales POS/ONLINE/DISTRIBUTOR),
selección de cliente (búsqueda por DNI/RUC o clientes frecuentes), aplicación de **cupones de
descuento** (campo en el POS que valida contra `POST /api/discounts/validate`), exportación del
historial a CSV/Excel/PDF e impresión del comprobante de una venta.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/sales` | `frontend/app/(dashboard)/sales/page.tsx` | server (async) | Precarga ventas con `serverApiFetch` y las pasa a `SalesPageClient`. |
| `/sales` | `frontend/app/(dashboard)/sales/sales-client.tsx` | client | KPIs de ventas, historial reciente y exportación. Refresca cada 30 s vía React Query. |
| `/sales/new` | `frontend/app/(dashboard)/sales/new/page.tsx` | server (async) | Precarga productos, clientes y distribuidores; renderiza `SaleForm`. Redirige a `/sign-in` sin sesión. |
| `/sales/[id]` | `frontend/app/(dashboard)/sales/[id]/page.tsx` | server (async) | Carga la venta por id y renderiza `SaleDetailClient`; `notFound()` si no existe. |
| `/sales/[id]` | `frontend/app/(dashboard)/sales/[id]/sale-detail-client.tsx` | client | Detalle de venta e impresión de comprobante. |

## Componentes

- `frontend/components/sales/sale-form.tsx` — formulario cliente POS completo: cliente (opcional), grilla de productos con filtro, carrito con presentaciones y control de cantidades, canal de venta (`POS`/`ONLINE`/`DISTRIBUTOR`), método de pago, descuento (%) y totales. Integra el escáner por lector de teclado (`useBarcodeScanner`), `ScannerStatus` y los beeps. Al completar muestra pantalla de confirmación con el número de ticket.
  - **Cupones**: estados `couponInput`/`appliedCoupon`/`couponError`/`couponLoading`; `handleApplyCoupon` llama a `POST /api/discounts/validate` y `handleRemoveCoupon` limpia el estado (input en mayúsculas). Con cupón aplicado se envía `couponCode` y el descuento manual queda deshabilitado (si no hay cupón se envía `discountAmount`). La sección "Cupón de descuento" se oculta en canal `DISTRIBUTOR` (y se limpia al cambiar a ese canal) y el resumen muestra `Cupón <code>`.
- `frontend/components/sales/new-sale-modal.tsx` — variante en `Dialog` del alta de venta, con búsqueda de producto, selección de cliente en `select`, método de pago, descuento con slider y cálculo de IGV (18%) en el cliente.
- `frontend/components/ui/customer-search.tsx` — buscador de cliente por documento: conmuta DNI (8 dígitos) / RUC (11 dígitos), consulta al backend y permite "Usar datos"; también sugiere clientes existentes por nombre/documento.
- `frontend/components/ui/customer-box-selector.tsx` — grilla de "clientes frecuentes" con filtro local por nombre, documento o email (sin llamadas al backend).
- `frontend/app/(dashboard)/sales/[id]/sale-detail-client.tsx` — detalle de la venta (cliente, vendedor, productos, resumen de pago) y botón "Imprimir" que genera y lanza la impresión del comprobante.

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `sales/page.tsx` | `GET /api/sales` | `serverApiFetch` | Lista las ventas más recientes (backend paginado con `page`/`limit`, def. 20; la página no envía parámetros). |
| `sales-client.tsx` | `GET /api/sales` | `apiFetch` (React Query) | Refresco automático cada 30 s; `initialData` = ventas server-side. |
| `sales-client.tsx` | `GET /api/sales/export?format=` | `apiFetch` | `format` ∈ `csv`/`excel`/`pdf`; descarga `{ data, contentType, filename }` como base64. |
| `sales/new/page.tsx` | `GET /api/products` | `serverApiFetch` | Productos disponibles para la venta. |
| `sales/new/page.tsx` | `GET /api/customers` | `serverApiFetch` | Clientes para los selectores. |
| `sales/new/page.tsx` | `GET /api/distributors` | `serverApiFetch` | Distribuidores para el canal `DISTRIBUTOR`. |
| `sale-form.tsx` (POS/ONLINE) | `POST /api/sales` | `apiFetch` | Envía `customerId`, `paymentMethod`, `channel`, `items[]` (`productId`, `quantity`, `presentationId`) y, según corresponda, `couponCode` (cupón aplicado) **o** `discountAmount`. |
| `sale-form.tsx` (aplicar cupón) | `POST /api/discounts/validate` | `apiFetch` | Valida código contra el subtotal del carrito; devuelve el cupón resuelto. |
| `sale-form.tsx` (DISTRIBUTOR) | `POST /api/distributors/:id/sales` | `apiFetch` | Venta contra consigna del distribuidor; invalida `['distributors']`. |
| `sale-detail/page.tsx` | `GET /api/sales/:id` | `serverApiFetch` | Detalle de la venta (`null` → `notFound()`; el backend responde 404 si no existe). |
| `sale-detail-client.tsx` | `GET /api/invoices/generate/:id` | `apiFetch` | Devuelve `{ html }`; se inyecta en un `iframe` (`srcdoc`) y se llama `print()`. |
| `customer-search.tsx` | `GET /api/dni/:dni` | `apiFetch` | Consulta de DNI (8 dígitos). |
| `customer-search.tsx` | `GET /api/dni/ruc/:ruc` | `apiFetch` | Consulta de RUC (11 dígitos). |
| `new-sale-modal.tsx` | `POST /api/sales` | `apiFetch` | Envía `customerId`, `paymentMethod`, `discountAmount`, `taxAmount` e `items[]`. |
| `customer-box-selector.tsx` | — | — | Filtra en memoria la lista `customers` recibida por props. |

## Estado global

- `useAuthStore` (`frontend/stores/auth.store.ts`): `user` en `sales-client.tsx`, `sale-form.tsx`, `sale-detail-client.tsx`, `new-sale-modal.tsx`.
- `useUiStore` (`frontend/store/ui-store.ts`): `addToast` (éxito/error/impresión).
- React Query (`useQueryClient`): invalida `['sales']`, `['products']`, `['dashboard']` (tras venta POS/ONLINE) y `['distributors']` (venta por distribuidor).
- Escáner por lector de teclado: `useBarcodeScanner` + `ScannerStatus` + `playScanBeep`/`playErrorBeep` (`frontend/components/scanner/*`).
- Formato/moneda: los importes se muestran en soles (`S/`) y las fechas con `toLocaleString('es-PE')`.

## Flujo de usuario

1. El usuario entra a `/sales` y ve KPIs (ventas hoy, ingresos hoy, total de ventas, ticket promedio) y el historial reciente; puede exportar en CSV/Excel/PDF.
2. Al pulsar "+ Nueva venta" navega a `/sales/new`.
3. En `SaleForm` selecciona cliente (opcional) vía `CustomerSearch` (DNI/RUC) o `CustomerBoxSelector`.
4. Agrega productos por búsqueda o clic en la grilla; también puede escanear un código con el lector (se agrega al carrito y suena un beep; si no hay stock o no existe, beep de error).
5. Ajusta cantidades y, si el producto tiene presentaciones, elige la presentación (recalcula precio y máximo por stock).
6. Elige canal de venta (`DISTRIBUTOR` exige seleccionar distribuidor) y método de pago; opcionalmente aplica descuento (%) o ingresa un cupón en "Cupón de descuento" y pulsa "Aplicar" (con cupón el descuento manual queda bloqueado).
7. Pulsa "Registrar venta": se hace `POST /sales` (o `POST /distributors/:id/sales`), se invalidan caches y se muestra la pantalla de confirmación con el número de ticket.
8. Desde el historial, al entrar a `/sales/[id]` se ve el detalle; "Imprimir" pide el HTML del comprobante a `/invoices/generate/:id` y abre el diálogo de impresión.

## Notas

- La administración de cupones vive en `/discounts` (ver `docs/sistema/frontend/discounts.md` y `docs/sistema/backend/discounts.md`); esta área solo los consume en el POS.
- El backend expone `POST /api/sales/:id/cancel` y `POST /api/sales/:id/refund`, pero **el frontend no tiene UI de anulación/reembolso** (no hay botones en `sale-detail-client.tsx` ni en `sales-client.tsx`). Pendiente.
- Exportación: `GET /api/sales/export?format=csv|excel|pdf`. Según el backend, `excel` produce un `.json` y `pdf` un `.html` (ver `docs/sistema/backend/sales.md`); el frontend solo descarga el base64.
- Impresión del comprobante: usa `GET /api/invoices/generate/:id` (ver `docs/sistema/backend/invoices.md`), que devuelve HTML; `sale-detail-client.tsx` no envía `templateId` (usa la plantilla por defecto).
- `new-sale-modal.tsx` existe pero no se encontró importado desde las páginas del área de ventas (la página de ventas enlaza a `/sales/new` y usa `SaleForm`). No verificado que se renderice en esta área.
- `sale-detail-client.tsx` importa el icono `Download` pero no lo usa; no implementa exportación (solo impresión).
 - `customer-search.tsx` dispara la búsqueda automáticamente al alcanzar la longitud válida del documento (8/11) y expone `direccion` en el resultado de RUC, aunque `SaleForm`/`SelectedCustomer` no persiste esos campos extra.

## Actualización: entradas numéricas y cupón alfanumérico

- `BarcodeScannerService` (`frontend/components/scanner/services/barcode-scanner.service.ts`) ahora ignora las teclas cuando el elemento enfocado es un campo editable (`INPUT`/`TEXTAREA`/`SELECT`/`contenteditable`), vía `isEditableTarget`. Antes hacía `preventDefault()` a cada dígito de forma global, lo que impedía escribir números en el formulario de venta (cantidad, descuento %, monto pagado y cupón). El escáner sigue funcionando cuando el foco no está en un input.
- El campo de cupón (`sale-form.tsx`) admite códigos alfanuméricos (mayúsculas + dígitos); solo se normaliza a mayúsculas, sin filtrar caracteres.

