# Módulo: Invoices

## Propósito
Gestiona las plantillas de comprobante (`InvoiceTemplate`) —globales o por empresa— y genera el HTML
de la boleta/factura de una venta para su impresión (formato A4 estándar o ticket térmico de 58 mm).

## Archivos clave
- `backend/src/modules/invoices/invoices.controller.ts` — rutas HTTP, guards y roles.
- `backend/src/modules/invoices/invoices.service.ts` — CRUD de plantillas, plantilla por defecto, generación y construcción de HTML.
- `backend/src/modules/invoices/dto/invoice.dto.ts` — `CreateInvoiceTemplateDto`, `UpdateInvoiceTemplateDto`, `GenerateInvoiceDto`.
- `backend/src/modules/invoices/invoices.module.ts` — registra controlador, servicio y `PrismaModule`.
- `backend/src/modules/invoices/invoices.service.spec.ts` — pruebas de aislamiento por tenant y generación de HTML.

## Endpoints

Guards a nivel de controlador: `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)`. No usa
`PermissionsGuard` ni `@RequireModule`, por lo que no hay gating por plan en este módulo.
El `tenantId` proviene del guard (`request.tenantId`).

### GET /api/invoices/templates
- **Descripción**: Lista plantillas activas de la empresa y globales.
- **Auth**: JWT, `@Roles(['SUPER_ADMIN'])`.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: array de `InvoiceTemplate` ordenado por `name` asc (`isActive: true` y (`companyId` o `isGlobal: true`)).
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards.

### GET /api/invoices/templates/:id
- **Descripción**: Obtiene una plantilla por id (de la empresa o global).
- **Auth**: JWT, `@Roles(['SUPER_ADMIN'])`.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id de la plantilla. |

- **Respuesta**: `InvoiceTemplate`.
- **Efectos secundarios**: ninguno.
- **Errores**: 404 `Plantilla no encontrada`.

### POST /api/invoices/templates/global
- **Descripción**: Crea una plantilla global (`isGlobal: true`, `companyId: null`).
- **Auth**: JWT, `@Roles(['SUPER_ADMIN'])`.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`.
- **Body (DTO `CreateInvoiceTemplateDto`)**: ver tabla abajo.
- **Respuesta**: la `InvoiceTemplate` creada.
- **Efectos secundarios**: escribe `invoice_templates`; si `isDefault` es true, marca `isDefault: false` en las plantillas previas con `companyId: null`.
- **Errores**: 403 `Debe especificar una empresa` solo aplica al caso no global (aquí es global); 400 validación.

### POST /api/invoices/templates
- **Descripción**: Crea una plantilla para la empresa.
- **Auth**: JWT, `@Roles(['SUPER_ADMIN'])`.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`.
- **Body (DTO `CreateInvoiceTemplateDto`)**: ver tabla abajo.
- **Respuesta**: la `InvoiceTemplate` creada.
- **Efectos secundarios**: escribe `invoice_templates`; si `isDefault` es true, marca `isDefault: false` en las plantillas previas de la misma empresa.
- **Errores**: 403 `Debe especificar una empresa` si no hay `companyId`; 400 validación.

**Body común a `createGlobalTemplate` y `createTemplate` (DTO `CreateInvoiceTemplateDto`)**

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `name` | string | no | `@IsString()` | Nombre (defecto `Plantilla`). |
| `description` | string | no | `@IsString()` | Descripción (no se usa en `create`, sí en `update`). |
| `type` | string | no | `@IsString()` | Tipo de comprobante (defecto `BOLETA`). |
| `headerText` | string | no | `@IsString()` | Texto de encabezado. |
| `logoUrl` | string | no | `@IsString()` | URL del logo. |
| `companyRuc` | string | no | `@IsString()` | RUC mostrado. |
| `companyAddress` | string | no | `@IsString()` | Dirección mostrada. |
| `companyPhone` | string | no | `@IsString()` | Teléfono mostrado. |
| `showLogo` | boolean | no | `@IsBoolean()` | Mostrar logo (defecto `true`). |
| `showCompany` | boolean | no | `@IsBoolean()` | Mostrar empresa (defecto `true`). |
| `showCustomer` | boolean | no | `@IsBoolean()` | Mostrar cliente (defecto `true`). |
| `showEmployee` | boolean | no | `@IsBoolean()` | Mostrar empleado (defecto `false`). |
| `showItems` | boolean | no | `@IsBoolean()` | Mostrar ítems (defecto `true`). |
| `showSubtotal` | boolean | no | `@IsBoolean()` | Mostrar subtotal (defecto `true`). |
| `showTax` | boolean | no | `@IsBoolean()` | Mostrar impuesto (defecto `true`). |
| `showDiscount` | boolean | no | `@IsBoolean()` | Mostrar descuento (defecto `true`). |
| `showSaleNumber` | boolean | no | `@IsBoolean()` | Mostrar número de venta (defecto `true`). |
| `showSaleDate` | boolean | no | `@IsBoolean()` | Mostrar fecha (defecto `true`). |
| `showSaleTime` | boolean | no | `@IsBoolean()` | Mostrar hora (defecto `false`). |
| `showPaymentMethod` | boolean | no | `@IsBoolean()` | Mostrar forma de pago (defecto `true`). |
| `footerText` | string | no | `@IsString()` | Texto de pie. |
| `taxPercentage` | number | no | `@IsNumber()`, `@Min(0)`, `@Max(100)` | Porcentaje de impuesto (defecto `18`). |
| `customFields` | object | no | `@IsObject()` | Campos personalizados (`Record<string, unknown>`). |
| `fontFamily` | string | no | `@IsString()`, `@Matches(/^[A-Za-z0-9 ,'"]*$/)` | Fuente (defecto `Arial`). |
| `fontSize` | number | no | `@IsNumber()`, `@Min(8)`, `@Max(20)` | Tamaño de fuente (defecto `12`). |
| `paperSize` | string | no | `@IsString()` | Tamaño de papel (defecto `A4`; `thermal` activa el ticket). |
| `isDefault` | boolean | no | `@IsBoolean()` | Marcar como predeterminada. |

### PATCH /api/invoices/templates/:id
- **Descripción**: Actualiza una plantilla (de la empresa o global).
- **Auth**: JWT, `@Roles(['SUPER_ADMIN'])`.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`.
- **Path params / Query / Body (DTO `UpdateInvoiceTemplateDto` `extends CreateInvoiceTemplateDto`)**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id de la plantilla. |
| Body | `UpdateInvoiceTemplateDto` | sí | mismas reglas que `CreateInvoiceTemplateDto` | Solo se actualizan los campos definidos. |

- **Respuesta**: la `InvoiceTemplate` actualizada.
- **Efectos secundarios**: escribe `invoice_templates`; si `isDefault` es true, desmarca las demás plantillas del mismo `companyId`.
- **Errores**: 404 `Plantilla no encontrada`; 400 validación.

### DELETE /api/invoices/templates/:id
- **Descripción**: Elimina físicamente una plantilla.
- **Auth**: JWT, `@Roles(['SUPER_ADMIN'])`.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `id` (path) | string | sí | — | Id de la plantilla. |

- **Respuesta**: la plantilla eliminada.
- **Efectos secundarios**: borra de `invoice_templates` (borrado físico, no lógico).
- **Errores**: 404 `Plantilla no encontrada`.

### GET /api/invoices/templates/default
- **Descripción**: Devuelve la plantilla efectiva para imprimir (preferentemente la de la empresa `isDefault`, luego la global `isDefault`, luego cualquiera de la empresa, luego cualquier global). Si no existe ninguna, devuelve una estructura por defecto en memoria (`id: 'default'`, "Boleta Standard").
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER', 'CASHIER'])`.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`.
- **Path params / Query / Body**: ninguno.
- **Respuesta**: `InvoiceTemplate` o la estructura por defecto.
- **Efectos secundarios**: ninguno.
- **Errores**: 401/403 por guards.

### GET /api/invoices/generate/:saleId
- **Descripción**: Genera el HTML del comprobante de una venta de la empresa.
- **Auth**: JWT, `@Roles(['COMPANY_ADMIN', 'MANAGER', 'CASHIER'])`.
- **Plan**: ninguno.
- **Guards extra**: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`.
- **Path params / Query / Body**:

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `saleId` (path) | string | sí | — | Id de la venta. |
| `templateId` (query) | string | no | — | Plantilla a usar; si se omite, se usa la predeterminada. |

- **Respuesta**: `{ html: string, template: InvoiceTemplate }`.
- **Efectos secundarios**: ninguno (solo lectura).
- **Errores**: 404 `Venta no encontrada` (la búsqueda es `{ id: saleId, companyId }`, por lo que una venta de otra empresa resulta 404); 404 `Plantilla no encontrada` si `templateId` no pertenece a la empresa ni es global.

## Funciones del servicio (`InvoicesService`)

### `findTemplates(companyId?, includeGlobal = true)`
- **Qué hace**: lista plantillas activas; si `includeGlobal`, incluye las globales.
- **Escribe en**: nada.
- **Devuelve**: array de `InvoiceTemplate`.
- **Lanza**: nada.

### `findTemplateById(id, companyId?)`
- **Qué hace**: busca plantilla por `id` con `(companyId)` o global.
- **Escribe en**: nada.
- **Devuelve**: `InvoiceTemplate`.
- **Lanza**: `NotFoundException('Plantilla no encontrada')`.

### `create(companyId, isGlobal, input)`
- **Qué hace**: valida empresa si no es global; aplica valores por defecto; si `isDefault`, desmarca las previas del mismo ámbito; crea la plantilla (`companyId: null` si global).
- **Escribe en**: `invoice_templates` (y `updateMany` de `isDefault`).
- **Devuelve**: `InvoiceTemplate` creada.
- **Lanza**: `ForbiddenException('Debe especificar una empresa')`.

### `update(id, companyId, input)`
- **Qué hace**: verifica existencia; si `isDefault`, desmarca las otras del mismo `companyId`; aplica solo campos definidos.
- **Escribe en**: `invoice_templates`.
- **Devuelve**: `InvoiceTemplate` actualizada.
- **Lanza**: `NotFoundException('Plantilla no encontrada')`.

### `remove(id, companyId)`
- **Qué hace**: verifica existencia y elimina físicamente.
- **Escribe en**: `invoice_templates` (delete).
- **Devuelve**: `InvoiceTemplate` eliminada.
- **Lanza**: `NotFoundException('Plantilla no encontrada')`.

### `getDefaultTemplate(companyId?)`
- **Qué hace**: prioriza por `isDefault` desc y `isGlobal` asc entre plantillas activas del ámbito; si no hay, devuelve estructura por defecto.
- **Escribe en**: nada.
- **Devuelve**: `InvoiceTemplate` o estructura por defecto.
- **Lanza**: nada.

### `getDefaultTemplateStructure()` (privado)
- **Qué hace**: construye una plantilla "Boleta Standard" en memoria.
- **Escribe en**: nada.
- **Devuelve**: objeto plantilla por defecto.
- **Lanza**: nada.

### `generateInvoiceHtml(saleId, companyId, templateId?)`
- **Qué hace**: resuelve la plantilla (por id o la predeterminada); busca la venta scopeada por `companyId` con `company`, `customer`, `employee` e `items.product`; construye el HTML.
- **Escribe en**: nada.
- **Devuelve**: `{ html, template }`.
- **Lanza**: `NotFoundException('Venta no encontrada')`; `NotFoundException('Plantilla no encontrada')`.

### `buildInvoiceHtml(sale, template, companyId)` (privado)
- **Qué hace**: prepara datos (empresa, cliente, ítems, fecha/hora, forma de pago), escapa HTML y decide entre ticket térmico (`paperSize === 'thermal'`) o factura estándar.
- **Escribe en**: nada.
- **Devuelve**: string HTML.
- **Lanza**: nada.

### `buildThermalTicket(...)` (privado)
- **Qué hace**: genera el HTML de ticket de 58 mm (monospace, `@media print` con `@page size: 58mm auto`).
- **Escribe en**: nada.
- **Devuelve**: string HTML.
- **Lanza**: nada.

### `buildStandardInvoice(...)` (privado)
- **Qué hace**: genera el HTML A4 con encabezado de empresa, bloque de información, tabla de ítems, totales y pie.
- **Escribe en**: nada.
- **Devuelve**: string HTML.
- **Lanza**: nada.

### `escapeHtml(value)` (función de módulo)
- **Qué hace**: escapa `& < > " '` para evitar inyección de HTML con datos de la venta/plantilla.
- **Escribe en**: nada.
- **Devuelve**: string escapado.
- **Lanza**: nada.

## Plantillas de boleta (`InvoiceTemplate`) y generación de HTML
- Ámbitos: plantilla global (`companyId: null`, `isGlobal: true`) o de empresa (`companyId`).
- `getDefaultTemplate` devuelve la estructura por defecto si no hay plantillas: `id 'default'`, tipo `BOLETA`, `taxPercentage 18`, `fontFamily 'Arial'`, `fontSize 12`, `paperSize 'A4'`, `footerText 'Gracias por su preferencia'`.
- Formas de pago etiquetadas en el HTML: `CASH → Efectivo`, `CARD → Tarjeta`, `TRANSFER → Transferencia`, `YAPE → Yape`, `PLIN → Plin`; si no coincide, se usa el valor crudo.
- El HTML usa datos de la venta (`subtotal`, `taxAmount`, `discountAmount`, `totalAmount`) y del producto (`name`); los importes se formatean a 2 decimales y los textos se escapan con `escapeHtml`.
- `type` de la plantilla define el título ("`<TIPO>` DE VENTA").

## Pruebas (`invoices.service.spec.ts`)
- `generateInvoiceHtml`: verifica que la consulta de la venta se scopea con `{ id, companyId }` y que una venta de otra empresa produce `NotFoundException`.
- `generateInvoiceHtml`: genera HTML para una venta propia y verifica que el HTML contenga el nombre de la empresa y del producto.

## Observaciones
- Orden de rutas: `GET templates/:id` está declarado antes que `GET templates/default`; en el enrutador de NestJS/Express la ruta dinámica podría capturar `/templates/default` tratando `default` como `:id`. No verificado en ejecución, pero es la consecuencia directa del orden declarado.
- El módulo no aplica permisos (`PermissionsGuard`) ni gating de plan (`@RequireModule`/`@RequirePlan`); la autorización es solo por rol con `RolesGuard`.
- `create` no persiste `description` (sí lo hace `update`), por lo que crear con `description` lo ignora.
