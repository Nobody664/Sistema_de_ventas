# Módulo: products

## Propósito

Gestiona el catálogo de productos y sus categorías dentro de una empresa (tenant). En este
módulo las categorías se administran DENTRO de `products` (no existe un módulo `categories`
separado); los endpoints de categorías están en `ProductsController` y se gatean con el módulo de
plan `categories`.

## Archivos clave

- `backend/src/modules/products/products.controller.ts` — rutas de productos y categorías.
- `backend/src/modules/products/products.service.ts` — lógica de negocio, categorías, presentaciones, exportación.
- `backend/src/modules/products/dto/product.dto.ts` — DTOs de creación/actualización y exportación.
- `backend/src/modules/products/products.module.ts` — importa `PrismaModule`, `LowStockModule`; provee `ProductsService` y `SubscriptionLimitService`.
- `backend/src/modules/products/products.service.spec.ts` — pruebas del servicio (no leídas en detalle).

## Autorización a nivel de controlador

- `@Controller('products')` con prefijo global → base real `/api/products`.
- Guards de clase: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)` (JWT + empresa activa + permisos).
- `@RequireModule('products')` a nivel de clase; los endpoints de categorías lo sobreescriben con `@RequireModule('categories')`.
- Guards globales aplicables: `CsrfGuard` (mutaciones), `ThrottlerGuard` (60 req/60s), y los guards de plan/permisos globales (ver `convenciones-api.md`).

## Endpoints

### GET /api/products/export
- **Descripción**: Exporta los productos de la empresa en CSV, Excel (JSON) o PDF (HTML), devolviendo el contenido en base64.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([product:export])`.
- **Plan**: `@RequireModule('products')`.
- **Guards extra**: ninguno (guards de clase).
- **Path params**: ninguno.
- **Query (DTO `ExportProductsQueryDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `format` | `'csv' \| 'excel' \| 'pdf'` | No (def. `csv`) | `@IsIn(['csv','excel','pdf'])` | Formato de salida |
  | `categoryId` | string | No | `@IsString()` | Filtra productos por categoría |

- **Body**: ninguno.
- **Respuesta**: `{ filename, contentType, data }` donde `data` es el contenido en base64. Para `excel` el `contentType` es `application/json` y el nombre termina en `.json`; para `pdf` es `text/html` y `.html`; para `csv` es `text/csv` y `.csv`. El nombre incluye la fecha `YYYY-MM-DD`.
- **Efectos secundarios**: solo lectura. No audita, no escribe kardex ni movimientos.
- **Errores**: los de gating/permisos; no se observa manejo específico adicional.

### GET /api/products/low-stock
- **Descripción**: Lista productos activos con `stockQuantity <= minStock`.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([product:view_low_stock])`.
- **Plan**: `@RequireModule('products')`.
- **Guards extra**: ninguno.
- **Query**: ninguno.
- **Body**: ninguno.
- **Respuesta**: array de `{ id, name, stockQuantity, minStock, category: { name } }` (máx. 100, ordenado por `stockQuantity` asc).
- **Efectos secundarios**: solo lectura.
- **Errores**: los de gating/permisos.

### GET /api/products/limits
- **Descripción**: Devuelve los límites e información de uso del plan para productos/categorías/etc.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([product:list])`.
- **Plan**: `@RequireModule('products')`.
- **Guards extra**: ninguno.
- **Query/Body**: ninguno.
- **Respuesta**: `{ limits, usage, percentages }` (resultado de `getAllLimitsInfo`; incluye `maxUsers`, `maxProducts`, `maxCustomers`, `maxEmployees`, `maxCategories`, `features`).
- **Efectos secundarios**: solo lectura.
- **Errores**: los de gating/permisos.

### GET /api/products/categories
- **Descripción**: Lista las categorías de la empresa con conteo de productos.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([category:list])`.
- **Plan**: `@RequireModule('categories')`.
- **Guards extra**: ninguno.
- **Query/Body**: ninguno.
- **Respuesta**: array de `Category` incluyendo `_count.products`, ordenado por `name` asc.
- **Efectos secundarios**: solo lectura.
- **Errores**: gating `MODULE_NOT_ENABLED` si el plan no incluye `categories`.

### GET /api/products/categories/:id
- **Descripción**: Obtiene una categoría por id dentro de la empresa.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([category:list])`.
- **Plan**: `@RequireModule('categories')`.
- **Path params**: `id` (id de categoría).
- **Respuesta**: objeto `Category` o `null` si no existe (usa `findFirst` sin lanzar excepción).
- **Efectos secundarios**: solo lectura.

### POST /api/products/categories
- **Descripción**: Crea una categoría.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([category:create])`.
- **Plan**: `@RequireModule('categories')` + `@LimitResource('categories')`.
- **Guards extra**: `@UseGuards(SubscriptionLimitGuard)` (valida límite del plan). Mutación requiere `Content-Type: application/json` (CsrfGuard).
- **Body (DTO `CreateCategoryDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `name` | string | Sí | `@IsString()` | Nombre de la categoría; se normaliza a `slug` |
  | `description` | string | No | `@IsString()` | Descripción |

- **Respuesta**: objeto `Category` creado.
- **Efectos secundarios**: escribe `categories`; valida límite con `SubscriptionLimitService.validateLimit`; `AuditService.log` (`CREATE`, entity `Category`).
- **Errores**: 409 `ConflictException` si ya existe el mismo `slug`; 403 `LIMIT_EXCEEDED` si se excede el límite.

### PATCH /api/products/categories/:id
- **Descripción**: Actualiza una categoría.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([category:update])`.
- **Plan**: `@RequireModule('categories')`.
- **Guards extra**: ninguno (mutación → Content-Type JSON).
- **Path params**: `id`.
- **Body (DTO `UpdateCategoryDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `name` | string | No | `@IsString()` | Si se envía, regenera `slug` |
  | `description` | string | No | `@IsString()` | Descripción |

- **Respuesta**: objeto `Category` actualizado.
- **Efectos secundarios**: escribe `categories`; `AuditService.log` (`UPDATE`, entity `Category`, con `before`/`after`).
- **Errores**: 404 `NotFoundException` si no existe.

### DELETE /api/products/categories/:id
- **Descripción**: Elimina una categoría (borrado físico) si no tiene productos asociados.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN'])` + `@Permissions([category:delete])`.
- **Plan**: `@RequireModule('categories')`.
- **Path params**: `id`.
- **Respuesta**: la categoría previamente existente (`existing`).
- **Efectos secundarios**: borra de `categories`; `AuditService.log` (`DELETE`, entity `Category`).
- **Errores**: 404 si no existe; 400 `BadRequestException` si tiene productos asociados (indica el conteo).

### GET /api/products
- **Descripción**: Lista productos de la empresa (máximo 50, orden por `createdAt` desc).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER','CASHIER'])` + `@Permissions([product:list])`.
- **Plan**: `@RequireModule('products')`.
- **Query/Body**: ninguno.
- **Respuesta**: array de productos con selección parcial (`id`, `name`, `sku`, `barcode`, `baseUnit`, `salePrice`, `costPrice`, `stockQuantity`, `minStock`, `isActive`, `imageUrl`, `description`, `createdAt`, `category {id,name}`, `presentations {id,name,factor,price}`).
- **Efectos secundarios**: solo lectura.

### GET /api/products/barcode/:code
- **Descripción**: Busca un producto por código de barras.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER','CASHIER'])` + `@Permissions([product:list])`.
- **Path params**: `code` (barcode).
- **Respuesta**: producto con `category` incluida, o `null` si no existe.
- **Efectos secundarios**: solo lectura.

### GET /api/products/:id
- **Descripción**: Obtiene un producto por id, con categoría y presentaciones.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER','CASHIER'])` + `@Permissions([product:list])`.
- **Path params**: `id`.
- **Respuesta**: producto con `category` y `presentations` (orden por `createdAt` asc), o `null`.
- **Efectos secundarios**: solo lectura.

### GET /api/products/:id/presentations
- **Descripción**: Lista las presentaciones de un producto.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER','CASHIER'])` + `@Permissions([product:list])`.
- **Path params**: `id` (producto).
- **Respuesta**: array de `ProductPresentation` (orden por `createdAt` asc).
- **Efectos secundarios**: solo lectura. Valida que el producto exista (404 si no).

### POST /api/products/:id/presentations
- **Descripción**: Crea una presentación para un producto.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([product:update])`.
- **Plan**: `@RequireModule('products')`.
- **Path params**: `id` (producto).
- **Body (DTO `CreatePresentationDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `name` | string | Sí | `@IsString()` | Nombre de la presentación |
  | `factor` | number | Sí | `@IsNumber({maxDecimalPlaces:3})`, `@Min(0.001)` | Factor de conversión a unidad base |
  | `price` | number | No | `@IsNumber({maxDecimalPlaces:4})`, `@Min(0)` | Precio de la presentación |
  | `barcode` | string | No | `@IsString()` | Código de barras |
  | `isActive` | boolean | No (def. `true`) | `@IsBoolean()` | Estado |

- **Respuesta**: `ProductPresentation` creado.
- **Efectos secundarios**: escribe `product_presentations`; asigna `companyId` del tenant. No audita, no genera kardex.
- **Errores**: 404 si el producto no existe; 409 si el `barcode` ya existe en la empresa.

### PATCH /api/products/presentations/:id
- **Descripción**: Actualiza una presentación.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([product:update])`.
- **Path params**: `id` (presentación).
- **Body (DTO `UpdatePresentationDto`)**: mismos campos que `CreatePresentationDto`, todos opcionales.
- **Respuesta**: `ProductPresentation` actualizado.
- **Efectos secundarios**: escribe `product_presentations`.
- **Errores**: 404 si no existe; 409 si el nuevo `barcode` ya existe en otra presentación.

### DELETE /api/products/presentations/:id
- **Descripción**: Elimina (borrado físico) una presentación.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([product:update])`.
- **Path params**: `id`.
- **Respuesta**: la presentación eliminada.
- **Efectos secundarios**: borra de `product_presentations`.
- **Errores**: 404 si no existe.

### POST /api/products
- **Descripción**: Crea un producto, opcionalmente con presentaciones anidadas.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([product:create])`.
- **Plan**: `@RequireModule('products')` + `@LimitResource('products')`.
- **Guards extra**: `@UseGuards(SubscriptionLimitGuard)`.
- **Body (DTO `CreateProductDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `categoryId` | string | No | `@IsString()` | Categoría (se valida que exista en la empresa) |
  | `sku` | string | No | `@IsString()` | Si no se envía se genera (`PREFIJO-######`) |
  | `barcode` | string | No | `@IsString()` | Si no se envía se genera EAN-13 (`7700...`) |
  | `name` | string | Sí | `@IsString()` | Nombre |
  | `description` | string | No | `@IsString()` | Descripción |
  | `imageUrl` | string | No | `@IsString()` | URL/base64 de imagen |
  | `baseUnit` | `UnitOfMeasure` | No (def. `UNIT`) | `@IsEnum(UnitOfMeasure)` | Unidad base (`UNIT`, `KG`, `LT`, `MT`) |
  | `costPrice` | number | Sí | `@IsNumber()` | Precio de costo |
  | `salePrice` | number | Sí | `@IsNumber()` | Precio de venta |
  | `stockQuantity` | number | No (def. 0) | `@IsNumber({maxDecimalPlaces:3})`, `@Min(0)` | Stock inicial |
  | `minStock` | number | No (def. 5) | `@IsNumber({maxDecimalPlaces:3})`, `@Min(0)` | Stock mínimo |
  | `presentations` | `CreatePresentationDto[]` | No | `@ValidateNested` | Presentaciones a crear en conjunto |

- **Respuesta**: producto creado (`include: { presentations: true }`).
- **Efectos secundarios**: escribe `products` y `product_presentations`; si `stockQuantity <= minStock` dispara `LowStockService.notifyIfLowStock` (crea notificaciones `LOW_STOCK`); `AuditService.log` (`CREATE`, entity `Product`). NO escribe `inventory_movements` ni kardex: el stock inicial se setea directo en el campo.
- **Errores**: 404 si `categoryId` no pertenece a la empresa; 403 `LIMIT_EXCEEDED`; conflictos de unicidad `(companyId, sku)` / `(companyId, barcode)` mapeados por Prisma.

**Manejo de `stockQuantity` en creación**: se asigna `input.stockQuantity ?? 0` directamente al campo del producto. No pasa por kardex ni por `inventory_movements`; es un valor inicial "abierto".

### PATCH /api/products/:id
- **Descripción**: Actualiza un producto.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([product:update])`.
- **Path params**: `id`.
- **Body (DTO `UpdateProductDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `categoryId` | string \| null | No | `@IsString()` | Categoría (si se envía se valida) |
  | `barcode` | string | No | `@IsString()` | Código de barras |
  | `name` | string | No | `@IsString()` | Nombre |
  | `description` | string | No | `@IsString()` | Descripción |
  | `imageUrl` | string | No | `@IsString()` | Imagen |
  | `baseUnit` | `UnitOfMeasure` | No | `@IsEnum(UnitOfMeasure)` | Unidad base |
  | `costPrice` | number | No | `@IsNumber()` | Precio de costo |
  | `salePrice` | number | No | `@IsNumber()` | Precio de venta |
  | `minStock` | number | No | `@IsNumber({maxDecimalPlaces:3})`, `@Min(0)` | Stock mínimo |

- **Respuesta**: producto actualizado.
- **Efectos secundarios**: escribe `products`; si se envía `minStock`, dispara `LowStockService.notifyIfLowStock` (con `previousStock`/`previousMinStock`); `AuditService.log` (`UPDATE`, entity `Product`, con `before`/`after`).
- **Errores**: 404 si el producto o la categoría no existen.

**Manejo de `stockQuantity` en edición**: `UpdateProductDto` NO incluye `stockQuantity`; no se puede modificar el stock desde este endpoint. El stock solo cambia vía `inventory` (ajustes), `stock-entries` (ingresos) o `sales`.

### DELETE /api/products/:id
- **Descripción**: Elimina un producto; hace soft-delete si tiene ventas o movimientos de inventario, de lo contrario borrado físico.
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN'])` + `@Permissions([product:delete])`.
- **Path params**: `id`.
- **Respuesta**: el producto resultante (soft-delete devuelve el registro actualizado; físico devuelve el `existing`).
- **Efectos secundarios**: si `saleItem.count > 0` o `inventoryMovement.count > 0` → `deletedAt=now`, `isActive=false` (soft-delete); si no → `deleteMany` (físico). `AuditService.log` (`DELETE`, entity `Product`).
- **Errores**: 404 si no existe.

### POST /api/products/:id/image
- **Descripción**: Sube/cambia la imagen del producto (base64).
- **Auth**: JWT + `@Roles(['COMPANY_ADMIN','MANAGER'])` + `@Permissions([product:update])`.
- **Path params**: `id`.
- **Body (DTO `UploadProductImageDto`)**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|------------|-------------|
  | `imageBase64` | string | Sí | `@IsString()` | Imagen en base64 |

- **Respuesta**: producto actualizado con `imageUrl=imageBase64`.
- **Efectos secundarios**: escribe `products.imageUrl`. No audita.
- **Errores**: 404 si el producto no existe.

## Funciones del servicio (`ProductsService`)

### `getLimitsInfo(companyId)`
- **Qué hace**: delega en `SubscriptionLimitService.getAllLimitsInfo`.
- **Escribe en**: nada.
- **Devuelve**: `{ limits, usage, percentages }`.
- **Lanza**: las del servicio de límites.

### `findProductById(companyId, id)`
- **Qué hace**: busca el producto con categoría y presentaciones.
- **Escribe en**: nada.
- **Devuelve**: producto o `null`.
- **Lanza**: nada.

### `findByBarcode(companyId, barcode)`
- **Qué hace**: busca por `companyId` + `barcode`.
- **Escribe en**: nada.
- **Devuelve**: producto o `null`.
- **Lanza**: nada.

### `findByCompany(companyId)`
- **Qué hace**: lista productos (máx. 50, `createdAt` desc) con categoría y presentaciones.
- **Escribe en**: nada.
- **Devuelve**: array de productos.
- **Lanza**: nada.

### `findCategories(companyId)`
- **Qué hace**: lista categorías con `_count.products`.
- **Escribe en**: nada.
- **Devuelve**: array de categorías.
- **Lanza**: nada.

### `findCategoryById(companyId, id)`
- **Qué hace**: busca categoría por id y empresa.
- **Devuelve**: categoría o `null`.

### `createCategory(companyId, input)`
- **Qué hace**: valida límite de categorías, genera `slug`, verifica duplicado y crea.
- **Escribe en**: `categories`; auditoría (`Category`).
- **Devuelve**: categoría creada.
- **Lanza**: 403 `LIMIT_EXCEEDED` (límite); 409 `ConflictException` (slug duplicado).

### `updateCategory(companyId, id, input)`
- **Qué hace**: asegura existencia, regenera `slug` si cambia el nombre y actualiza.
- **Escribe en**: `categories`; auditoría (`Category`, `UPDATE`).
- **Devuelve**: categoría actualizada.
- **Lanza**: 404 si no existe.

### `removeCategory(companyId, id)`
- **Qué hace**: asegura existencia, verifica que no haya productos asociados y elimina.
- **Escribe en**: borra de `categories`; auditoría (`Category`, `DELETE`).
- **Devuelve**: la categoría eliminada.
- **Lanza**: 404 si no existe; 400 si tiene productos.

### `createProduct(companyId, input)`
- **Qué hace**: valida límite de productos, resuelve categoría, genera `sku`/`barcode` si faltan, crea producto y presentaciones anidadas.
- **Escribe en**: `products`, `product_presentations`; notificaciones de stock bajo; auditoría (`Product`, `CREATE`).
- **Devuelve**: producto con presentaciones.
- **Lanza**: 403 `LIMIT_EXCEEDED`; 404 si la categoría no existe; conflictos Prisma de unicidad.

### `updateProduct(companyId, id, input)`
- **Qué hace**: asegura producto y categoría, actualiza campos permitidos, evalúa stock bajo si cambia `minStock`.
- **Escribe en**: `products`; notificaciones; auditoría (`Product`, `UPDATE`).
- **Devuelve**: producto actualizado.
- **Lanza**: 404 si producto o categoría no existen.

### `removeProduct(companyId, id)`
- **Qué hace**: decide soft-delete vs borrado físico según ventas/movimientos existentes.
- **Escribe en**: `products` (update o delete); auditoría (`Product`, `DELETE`).
- **Devuelve**: producto resultante.
- **Lanza**: 404 si no existe.

### `listPresentations(companyId, productId)`
- **Qué hace**: asegura producto y lista presentaciones.
- **Escribe en**: nada.
- **Devuelve**: array de presentaciones.
- **Lanza**: 404 si el producto no existe.

### `createPresentation(companyId, productId, input)`
- **Qué hace**: asegura producto, valida barcode único y crea.
- **Escribe en**: `product_presentations`.
- **Devuelve**: presentación creada.
- **Lanza**: 404 si el producto no existe; 409 si el barcode ya existe.

### `updatePresentation(companyId, presentationId, input)`
- **Qué hace**: busca la presentación, valida barcode único si cambia y actualiza.
- **Escribe en**: `product_presentations`.
- **Devuelve**: presentación actualizada.
- **Lanza**: 404 si no existe; 409 si el barcode pertenece a otra.

### `removePresentation(companyId, presentationId)`
- **Qué hace**: busca y elimina la presentación.
- **Escribe en**: borra de `product_presentations`.
- **Devuelve**: la presentación eliminada.
- **Lanza**: 404 si no existe.

### `getLowStockProducts(companyId)`
- **Qué hace**: trae productos activos ordenados por stock y filtra en memoria `stockQuantity <= minStock` (máx. 100).
- **Devuelve**: array `{ id, name, stockQuantity, minStock, category }`.

### `uploadProductImage(companyId, productId, imageBase64)`
- **Qué hace**: asegura producto y actualiza `imageUrl`.
- **Escribe en**: `products.imageUrl`.
- **Devuelve**: producto actualizado.
- **Lanza**: 404 si no existe.

### `exportProducts(companyId, query)`
- **Qué hace**: filtra por `categoryId`, genera CSV/Excel/PDF en base64 según `format`.
- **Escribe en**: nada.
- **Devuelve**: `{ filename, contentType, data }`.
- **Lanza**: nada específico.

### Helpers privados
- `ensureProduct(companyId, id)` — lanza 404 si no existe; devuelve el producto.
- `ensureCategory(companyId, id)` — lanza 404 si no existe; devuelve la categoría.
- `generateSku(name, categoryName?)` — prefijo de 3 letras de la categoría o `PRD` + 6 dígitos.
- `generateBarcode()` — EAN-13 con prefijo `7700` y dígito verificador calculado.
- `calculateEan13CheckDigit(base)` — dígito verificador EAN-13.
- `generateCsvExport` / `generateExcelExport` / `generatePdfExport` — serializan la salida (el PDF es HTML con valores escapados vía `escapeHtml`).

## No verificado en el código

- No se encontró un `PaginationDto` en este módulo: `GET /api/products` no acepta `page`/`limit` (usa `take: 50` fijo).
- No se verificó que el guard `SubscriptionLimitGuard` aplique en el orden exacto respecto a `PermissionsGuard` (ambos están declarados; el orden de resolución no se inspeccionó en detalle).

## Actualizacion: fecha de vencimiento

- `CreateProductDto`/`UpdateProductDto` aceptan `expiryDate?: string | null` (ISO 8601). `createProduct` persiste `expiryDate` y `updateProduct` lo convierte a `Date` (`null` lo limpia); `findByCompany` lo incluye en el `select`.
- Al crear o al cambiar `minStock`/`expiryDate` se disparan las alertas de stock bajo y de vencimiento (`LowStockService.notifyIfExpiring`) en modo best-effort (try/catch), sin bloquear la operacion.
- El listado del frontend muestra columnas **Registro** (`createdAt`) y **Vencimiento** (badge Vencido / Por vencer / Vigente).
