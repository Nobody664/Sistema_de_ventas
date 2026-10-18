# Área: Productos y categorías

CRUD del catálogo de productos y sus categorías. Incluye formularios con presentaciones (empaques),
subida de imagen en base64, exportación a CSV/Excel/PDF y escaneo de códigos de barras (por cámara
y por lector tipo teclado).

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/products` | `frontend/app/(dashboard)/products/page.tsx` | server (async) | Precarga productos y categorías con `serverApiFetch` y los pasa a `ProductsPageClient`. |
| `/products` | `frontend/app/(dashboard)/products/products-client.tsx` | client | Lista de productos con KPIs, búsqueda, filtro por categoría, exportación y lightbox de imagen. |
| `/products/new` | `frontend/app/(dashboard)/products/new/page.tsx` | server (async) | Carga categorías y renderiza `ProductForm` (modo creación). Redirige a `/sign-in` sin sesión. |
| `/products/[id]` | `frontend/app/(dashboard)/products/[id]/page.tsx` | server (async) | Detalle de producto: hero con nombre/estado, KPIs (precio venta/costo, stock actual/mínimo), datos generales y lista de presentaciones; `notFound()` si no existe. |
| `/products/[id]/edit` | `frontend/app/(dashboard)/products/[id]/edit/page.tsx` | server (async) | Carga el producto y categorías; renderiza `ProductForm` (modo edición); `notFound()` si no existe. |
| `/categories` | `frontend/app/(dashboard)/categories/page.tsx` | server (async, `dynamic = 'force-dynamic'`) | Lista categorías con conteo de productos; renderiza `CategoryActions`/`NewCategoryButton`. |
| `/categories/new` | `frontend/app/(dashboard)/categories/new/page.tsx` | server (async) | Renderiza `CategoryForm` (modo creación). Redirige a `/sign-in` sin sesión. |
| `/categories/[id]` | `frontend/app/(dashboard)/categories/[id]/page.tsx` | server (async) | Detalle de categoría (nombre, slug, descripción, fechas y conteo de productos); `notFound()` si no existe. |
| `/categories/[id]/edit` | `frontend/app/(dashboard)/categories/[id]/edit/page.tsx` | server (async) | Carga la categoría y renderiza `CategoryForm` (modo edición); `notFound()` si no existe. |

## Componentes

- `frontend/components/products/product-form.tsx` — formulario cliente de creación/edición. Maneja imagen (base64), SKU (bloqueado en edición), categoría, precios, unidad base, `minStock`, `stockQuantity` (solo creación) y filas dinámicas de presentaciones. Valida con Zod (`createProductSchema`/`updateProductSchema`) y usa `handleLimitError` para errores de plan.
- `frontend/components/products/product-actions.tsx` — acciones de fila: `ProductActions` (enlace a editar + `DeleteDialog`) y `NewProductButton` (enlace a `/products/new`). Ambas protegidas con `PermissionGuard` (`product:create`, `product:delete`).
- `frontend/components/products/image-lightbox.tsx` — visor de imagen a pantalla completa con cierre por `Escape`/clic y bloqueo de scroll.
- `frontend/components/categories/category-form.tsx` — formulario cliente de creación/edición de categoría (nombre y descripción) con validación Zod (`createCategorySchema`).
- `frontend/components/categories/category-actions.tsx` — `CategoryActions` (editar + eliminar; deshabilita eliminar si la categoría tiene productos) y `NewCategoryButton`; protegidos con `PermissionGuard`.
- `frontend/components/categories/category-modal.tsx` — modal `Dialog` para crear/editar categoría sin salir de la página.
- `frontend/components/scanner/index.ts` — barrel que exporta `BarcodeScannerService`, `useBarcodeScanner`, `ScannerStatus`, `playScanBeep`, `playErrorBeep`.
- `frontend/components/scanner/hooks/useBarcodeScanner.ts` — hook que instancia `BarcodeScannerService`, expone `isConnected` y engancha `onScan`/`onStatus`; arranca/para según `enabled`.
- `frontend/components/scanner/services/barcode-scanner.service.ts` — servicio que escucha `keydown` (lector tipo teclado), acumula dígitos y detecta escaneos por velocidad/tiempo (`scanThreshold`, `bufferTimeout`, `maxLength`).
- `frontend/components/scanner/services/sound.ts` — `playScanBeep` y `playErrorBeep` con Web Audio API.
- `frontend/components/scanner/components/scanner-status.tsx` — indicador visual "Escáner listo / no detectado".
- `frontend/components/ui/barcode-scanner.tsx` — escáner por **cámara** usando `BarcodeDetector` nativo del navegador; avisa si no está soportado (sugiere Chrome/Edge).

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `products/page.tsx` | `GET /api/products` | `serverApiFetch` | Lista de productos (backend limita a 50). |
| `products/page.tsx` | `GET /api/products/categories` | `serverApiFetch` | Categorías para el filtro y los formularios. |
| `products-client.tsx` | `GET /api/products/export?format=&categoryId=` | `apiFetch` | `format` ∈ `csv`/`excel`/`pdf`. La respuesta `{ data, contentType, filename }` se descarga como `data:<contentType>;base64,<data>`. |
| `product-actions.tsx` | `DELETE /api/products/:id` | `DeleteDialog` → `apiFetch` | Invalida la query `['products']`. |
| `products/new/page.tsx` | `GET /api/products/categories` | `serverApiFetch` | Categorías. |
| `products/[id]/edit/page.tsx` | `GET /api/products/:id` | `serverApiFetch` | Producto a editar (devuelve `null` si falla). |
| `products/[id]/edit/page.tsx` | `GET /api/products/categories` | `serverApiFetch` | Categorías. |
| `product-form.tsx` (crear) | `POST /api/products` | `apiFetch` | Envía también `presentations[]` en línea. |
| `product-form.tsx` (editar) | `PATCH /api/products/:id` | `apiFetch` | No envía `stockQuantity`. |
| `product-form.tsx` (editar) | `POST /api/products/:id/presentations` | `apiFetch` | Crea presentaciones nuevas. |
| `product-form.tsx` (editar) | `PATCH /api/products/presentations/:id` | `apiFetch` | Actualiza presentaciones existentes. |
| `product-form.tsx` (editar) | `DELETE /api/products/presentations/:id` | `apiFetch` | Elimina las presentaciones quitadas del formulario. |
| `categories/page.tsx` | `GET /api/products/categories` | `serverApiFetch` | Lista con `_count.products`. |
| `categories/new/page.tsx` | — | — | No hace fetch (el `CategoryForm` hace la mutación). |
| `categories/[id]/edit/page.tsx` | `GET /api/products/categories/:id` | `serverApiFetch` | Categoría a editar (devuelve `null` si falla). |
| `category-form.tsx` | `POST /api/products/categories` | `apiFetch` | Crear. |
| `category-form.tsx` | `PATCH /api/products/categories/:id` | `apiFetch` | Editar. |
| `category-actions.tsx` | `DELETE /api/products/categories/:id` | `DeleteDialog` → `apiFetch` | Invalida `['categories']`. |
| `category-modal.tsx` | `POST` / `PATCH /api/products/categories[/:id]` | `apiFetch` | Crear/editar desde modal; luego `router.refresh()`. |
| Escáner (`scanner/*`, `ui/barcode-scanner.tsx`) | — | — | No llaman al backend; el código detectado se entrega por callback (`onScan`/`onDetected`). |

## Estado global

- `useAuthStore` (`frontend/stores/auth.store.ts`): `user` en `product-form.tsx`, `category-form.tsx`, `category-modal.tsx`, `products-client.tsx`.
- `useUiStore` (`frontend/store/ui-store.ts`): `addToast` para notificaciones de éxito/error.
- React Query (`useQueryClient`, `@tanstack/react-query`): invalidación de `['products']` (form/delete de producto) y `['categories']` (form/modal/delete de categoría).
- `PermissionGuard` + `usePermissions` (`frontend/hooks/usePermissions.ts`): controlan visibilidad de acciones (`product:create`, `product:delete`, `category:create`, `category:update`, `category:delete`).
- Validaciones Zod: `frontend/lib/validations/product.validation.ts` y `frontend/lib/validations/category.validation.ts`.

## Flujo de usuario

1. En `/products` el usuario ve KPIs (total, stock bajo, valor de inventario) y la tabla; puede buscar por nombre/SKU, filtrar por categoría y exportar a CSV/Excel/PDF.
2. Al pulsar una imagen se abre `ImageLightbox`; "Editar" navega a `/products/[id]/edit`; "Eliminar" abre `DeleteDialog`.
3. `NewProductButton` (visible con permiso `product:create`) navega a `/products/new`.
4. En el formulario, el usuario completa datos básicos, precios, unidad base, `minStock`, stock inicial (solo al crear) y presentaciones; puede escanear el código de barras con la cámara (`BarcodeScanner`).
5. Al enviar, el formulario valida con Zod, luego `POST /products` o `PATCH /products/:id`; en edición sincroniza presentaciones (crear/actualizar/eliminar). Finalmente invalida `['products']`, muestra toast y redirige a `/products`.
6. En `/categories` el usuario ve la grilla de categorías; `NewCategoryButton`/`CategoryActions` permiten crear/editar. La eliminación se bloquea si `_count.products > 0`.
7. Crear/editar categoría ocurre en `/categories/new` o `/categories/[id]/edit` (formulario de página) o mediante `CategoryModal`.

## Notas

- La imagen del producto se guarda como base64 dentro de `imageUrl` al crear/actualizar; no se observó el uso del endpoint `POST /products/:id/image` desde estos componentes (no verificado).
- La exportación `excel` devuelve JSON y `pdf` devuelve HTML (según `docs/sistema/backend/products.md`); el frontend no lo transforma, solo descarga el base64.
- El escáner de `ui/barcode-scanner.tsx` (cámara, `BarcodeDetector`) y el de `components/scanner/*` (lector tipo teclado) son mecanismos distintos; el formulario de producto usa el de cámara.
- El listado de productos no pagina en el frontend (el backend devuelve hasta 50).
- `ProductActions` no incluye botón de borrado si el usuario carece de `product:delete`; el enlace de edición no está envuelto en `PermissionGuard`.

## Actualizacion: vencimiento en el listado y el formulario

- `/products` agrega las columnas **Registro** (`createdAt` formateado) y **Vencimiento** (componente `ExpiryBadge`: fecha + badge Vencido / Por vencer (<= 3 dias) / Vigente, o `-` sin fecha); el `colSpan` del estado vacio pasa a 10.
- `product-form.tsx` incluye el campo `expiryDate` (`CalendarClock`, input `type=date`) con el aviso "Te avisaremos 3 dias antes del vencimiento."; en edicion envia `expiryDate ?? null`.
- `frontend/lib/validations/product.validation.ts` acepta `expiryDate` opcional; `Product.expiryDate` existe en `frontend/types/generated.ts`.
