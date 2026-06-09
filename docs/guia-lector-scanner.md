# Guía de Escáner de Código de Barras

## Visión General

El sistema Soporte de Ventas integra lectura de códigos de barras en dos contextos distintos:

| Contexto | Estado | URL | Componente |
|----------|--------|-----|------------|
| Creación/edición de productos | ✅ Implementado | `/products/new`, `/products/[id]/edit` | `BarcodeScanner` (cámara) |
| Punto de venta (POS) | 🚧 Planeado | `/sales/new` | `BarcodeScannerService` (HID USB) |

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 16)                    │
│                                                             │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ BarcodeScanner   │  │ SaleForm      │  │ ProductForm     │ │
│  │ (ui/component)   │  │ (sales/)      │  │ (products/)     │ │
│  └────────┬────────┘  └──────┬───────┘  └───────┬────────┘ │
│           │                  │                   │          │
│  ┌────────┴──────────────────┴───────────────────┴───────┐ │
│  │              TanStack Query + Zustand                  │ │
│  │              apiFetch('/products', ...)                 │ │
│  └───────────────────────────┬───────────────────────────┘ │
│                              │                              │
│                    ┌─────────┴──────────┐                   │
│                    │   Proxy (proxy.ts)  │                   │
│                    │    /api → backend   │                   │
│                    └─────────┬──────────┘                   │
└──────────────────────────────┼──────────────────────────────┘
                               │ HTTP
┌──────────────────────────────┼──────────────────────────────┐
│                    Backend (NestJS)                          │
│                              │                              │
│  ┌───────────────────────────┴───────────────────────────┐ │
│  │                   Guards Pipeline                      │ │
│  │  JwtAuthGuard → TenantGuard → PermissionsGuard → ...  │ │
│  │         (request.tenantId = user.companyId)            │ │
│  └───────────────────────────┬───────────────────────────┘ │
│                              │                              │
│  ┌───────────────────────────┴───────────────────────────┐ │
│  │                  ProductsController                    │ │
│  │    GET /products          → list (tenant-scoped)       │ │
│  │    GET /products/:id      → by ID (tenant-scoped)      │ │
│  │    POST /products         → create (con barcode)       │ │
│  │    PATCH /products/:id    → update                     │ │
│  └───────────────────────────┬───────────────────────────┘ │
│                              │                              │
│  ┌───────────────────────────┴───────────────────────────┐ │
│  │                    ProductsService                      │ │
│  │  - Auto-generación de EAN-13 si no se provee barcode   │ │
│  │  - Búsqueda por companyId (tenant isolation)            │ │
│  │  - Validación de límites por plan (SubscriptionLimit)   │ │
│  └───────────────────────────┬───────────────────────────┘ │
│                              │                              │
│  ┌───────────────────────────┴───────────────────────────┐ │
│  │                 Prisma ORM + PostgreSQL                 │ │
│  │  Product { barcode, sku, name, salePrice, companyId }  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Modo 1: Escáner por Cámara (BarcodeDetector API) — Implementado

### Propósito

Capturar códigos de barras durante la creación o edición de productos, usando la cámara del dispositivo.

### Tecnología

- **API**: `BarcodeDetector` (Chromium 81+) — acelerada por hardware
- **Stream**: `navigator.mediaDevices.getUserMedia` con `facingMode: 'environment'`
- **Formato del video**: 640×480, cámara trasera

### Componente

**Archivo**: `frontend/components/ui/barcode-scanner.tsx`

```
BarcodeScanner
├── Detección de soporte (BarcodeDetector in window)
├── Botón de activación (ícono Camera)
├── Modal fullscreen negro
│   ├── Header: instrucción + botón cerrar
│   ├── Video <video> con stream de cámara
│   ├── Viewfinder: recuadro verde + línea pulsante + overlay oscuro
│   └── Footer: mensaje de ayuda + error
└── Callback: onDetected(barcode: string) → setBarcodeValue
```

### Integración en ProductForm

**Archivo**: `frontend/components/products/product-form.tsx`

```tsx
// Estado local para el barcode (controlled input)
const [barcodeValue, setBarcodeValue] = useState(product?.barcode || '');

// En el JSX, junto al input de código de barras:
<div className="flex gap-2">
  <Input name="barcode" value={barcodeValue} ... />
  <BarcodeScanner onDetected={(code) => setBarcodeValue(code)} />
</div>
```

### Formatos Soportados

| Formato | Uso típico |
|---------|-----------|
| `ean_13` | Estándar en Perú y LATAM (13 dígitos) |
| `ean_8` | Productos pequeños |
| `code_128` | Logística, inventario interno |
| `code_39` | Industria, etiquetas internas |
| `upc_a` / `upc_e` | Productos importados de USA |
| `codabar` | Librerías, transporte |
| `itf` | Empaques de distribución |

### Fallbacks

- `BarcodeDetector` no disponible → mensaje ámbar: "Usa Chrome o Edge"
- Cámara denegada → error en modal: "No se pudo acceder a la cámara"
- Sin detección → usuario cierra manualmente

### Limitaciones

- Solo Chromium (Chrome, Edge, Opera). No Safari ni Firefox.
- Requiere HTTPS (o localhost).
- No funciona con escáneres USB de alta velocidad.

---

## Modo 2: Escáner USB HID Keyboard Emulation — Planificado

### Propósito

Soporte para escáneres profesionales en caja POS de alto flujo (bodegas, licorerías, minimarkets).

### Modelos de Hardware Referencia

- Zebra DS2208
- Honeywell Voyager 1470g
- Datalogic QuickScan QD2430

### Funcionamiento

El escáner se comporta como un teclado USB. Al escanear `7501234567890`, el sistema recibe caracteres como eventos de teclado a velocidad de escáner (~2-5ms por carácter), seguido de `Enter`.

### Arquitectura Propuesta

```
components/
└── scanner/
    ├── services/
    │   └── barcode-scanner.service.ts    // Lógica HID: buffer, detección, eventos
    ├── hooks/
    │   └── useBarcodeScanner.ts          // Hook React: conexión servicio ↔ componente
    └── components/
        └── scanner-status.tsx            // Indicador 🟢/🔴 estado del escáner
```

#### Servicio: BarcodeScannerService

```typescript
// Detección inteligente: diferencia escritura humana vs escáner
// - Humano: >100ms entre caracteres
// - Escáner: <30ms entre caracteres
// Buffer temporal con timestamp por tecla
// Emite evento onScan(codigo) al detectar Enter o timeout
```

#### Hook: useBarcodeScanner

```typescript
// Conexión automática al montar la página POS
// Desconexión al desmontar
// Callback onScan para buscar producto y agregar al carrito
// Estado: connecting / connected / disconnected / error
```

#### Integración en SaleForm

```typescript
// En components/sales/sale-form.tsx
const { isConnected } = useBarcodeScanner({
  onScan: (barcode) => {
    // 1. Buscar producto por barcode en la lista local de productos
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addItem(product);          // Agregar al carrito
      playSuccessSound();        // Feedback audible
    } else {
      showToast('Producto no encontrado', 'error');
    }
  },
});
```

### Flujo POS con Escáner USB

```
Cajero pasa producto por escáner
        │
        ▼
Escáner emula teclado: "7501234567890<Enter>"
        │
        ▼
useBarcodeScanner.onScan("7501234567890")
        │
        ├─▶ ¿Producto existe en productos[]?
        │       │
        │       ├─▶ Sí → addItem(product) → carrito actualizado
        │       │        │
        │       │        └─▶ useEffect: subtotal, total, UI
        │       │
        │       └─▶ No → toast "Código no encontrado"
        │
        └─▶ (Futuro) GET /products/barcode/:code si no está en caché
```

### Requisitos para Modo HID

1. **No requiere drivers** — funciona con cualquier navegador moderno
2. **No requiere clic en input** — listener global con detección inteligente
3. **Soporta lecturas consecutivas** — múltiples productos por segundo
4. **Indicador visual** de estado del escáner (conectado/desconectado)
5. **Feedback audible** opcional al leer exitosamente

---

## Backend: Endpoints de Producto

### GET /products (listar productos del tenant)

```typescript
// ProductsController
@Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
@Permissions(Permission.PRODUCT_LIST)
@Get()
findByCompany(@Req() request: { tenantId: string }) {
  return this.productsService.findByCompany(request.tenantId);
}
```

```typescript
// ProductsService — tenant-scoped query
findByCompany(companyId: string) {
  return this.prisma.product.findMany({
    where: { companyId },
    select: {
      id, name, sku, barcode, salePrice, costPrice,
      stockQuantity, minStock, isActive, imageUrl, description, createdAt,
      category: { select: { id, name } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
```

### POST /products (crear producto con barcode)

```typescript
@Roles('COMPANY_ADMIN', 'MANAGER')
@Permissions(Permission.PRODUCT_CREATE)
@UseGuards(SubscriptionLimitGuard)
@LimitResource('products')
@Post()
createProduct(@Req() request: { tenantId: string }, @Body() body: CreateProductDto) {
  return this.productsService.createProduct(request.tenantId, body);
}
```

- Si no se provee `barcode`, se auto-genera un EAN-13: `7700` + 8 dígitos + dígito verificador
- Si no se provee `sku`, se auto-genera: `{CATEGORÍA}-{6 dígitos}`
- Tenant isolation: `companyId` siempre en `where`

### Endpoint de búsqueda por código de barras (futuro)

Actualmente los productos se filtran por nombre/SKU desde el frontend. Para POS con escáner se recomienda agregar:

```typescript
// ProductsController
@Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
@Permissions(Permission.PRODUCT_LIST)
@Get('barcode/:code')
findByBarcode(@Req() request: { tenantId: string }, @Param('code') code: string) {
  return this.productsService.findByBarcode(request.tenantId, code);
}
```

```typescript
// ProductsService
findByBarcode(companyId: string, barcode: string) {
  return this.prisma.product.findFirst({
    where: { companyId, barcode },
  });
}
```

---

## Modelo de Datos (Prisma)

```prisma
model Product {
  id             String    @id @default(cuid())
  companyId      String
  categoryId     String?
  sku            String    @unique
  barcode        String?   @unique
  name           String
  description    String?
  imageUrl       String?
  costPrice      Decimal   @default(0)
  salePrice      Decimal   @default(0)
  stockQuantity  Int       @default(0)
  minStock       Int       @default(5)
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  company        Company   @relation(fields: [companyId], references: [id])
  category       Category? @relation(fields: [categoryId], references: [id])
  saleItems      SaleItem[]
  movements      InventoryMovement[]
}

model Sale {
  id            String       @id @default(cuid())
  companyId     String
  customerId    String?
  employeeId    String?
  saleNumber    String       @unique
  subtotal      Decimal
  taxAmount     Decimal      @default(0)
  discountAmount Decimal     @default(0)
  totalAmount   Decimal
  paymentMethod String       // CASH | CARD | TRANSFER
  paidAmount    Decimal      @default(0)
  changeAmount  Decimal      @default(0)
  status        SaleStatus   @default(COMPLETED)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  company       Company      @relation(fields: [companyId], references: [id])
  customer      Customer?    @relation(fields: [customerId], references: [id])
  employee      Employee?    @relation(fields: [employeeId], references: [id])
  items         SaleItem[]
}

model SaleItem {
  id         String  @id @default(cuid())
  saleId     String
  productId  String
  quantity   Int
  unitPrice  Decimal
  totalPrice Decimal

  sale       Sale    @relation(fields: [saleId], references: [id])
  product    Product @relation(fields: [productId], references: [id])
}
```

---

## Permisos y Roles Relacionados

| Permiso | Roles | Endpoint |
|---------|-------|----------|
| `PRODUCT_LIST` | COMPANY_ADMIN, MANAGER, CASHIER | GET /products |
| `PRODUCT_CREATE` | COMPANY_ADMIN, MANAGER | POST /products |
| `PRODUCT_UPDATE` | COMPANY_ADMIN, MANAGER | PATCH /products/:id |
| `PRODUCT_DELETE` | COMPANY_ADMIN | DELETE /products/:id |

---

## Data Flow Completo: Creación de Producto con Escáner

```
1. Usuario abre /products/new
        │
2. ProductForm se renderiza
   - fetch categorías vía TanStack Query (o serverApiFetch)
   - barcode input en estado controlled (useState)
        │
3. Usuario hace clic en botón 📷
        │
4. BarcodeScanner.startScanning()
   - getUserMedia({ facingMode: 'environment' })
   - Crea BarcodeDetector con formatos compatibles
   - Abre modal fullscreen con video stream
        │
5. requestAnimationFrame loop:
   - detector.detect(videoRef.current)
   - Si barcode encontrado → onDetected(rawValue) → stopCamera()
        │
6. setBarcodeValue(código) → input se llena automáticamente
        │
7. Usuario completa demás campos y envía formulario
        │
8. createProductSchema.safeParse(data) — validación Zod
        │
9. apiFetch('POST /products', { body: JSON.stringify(data) })
        │
10. Backend:
    - JwtAuthGuard → TenantGuard → PermissionsGuard → SubscriptionLimitGuard
    - ProductsService.createProduct(tenantId, data)
    - Prisma: Product.create({ data: { companyId, ... } })
    - Retorna producto creado
        │
11. Frontend:
    - queryClient.invalidateQueries({ queryKey: ['products'] })
    - router.push('/products')
    - addToast('Producto creado correctamente', 'success')
```

---

## Plan de Implementación: Modo HID (POS)

### Fase 1: Servicio base ✅
- [x] Crear `components/scanner/services/barcode-scanner.service.ts`
  - Listener global `keydown` con buffer de caracteres + timestamps
  - Detección escáner vs humano: umbral <30ms entre caracteres
  - Detección de fin de lectura: Enter o Tab
  - Timeout de buffer: 200ms para detectar escritura lenta
  - Sistema de eventos desacoplado: `onScan`, `onStatus`, `onError`

### Fase 2: Hook React ✅
- [x] Crear `components/scanner/hooks/useBarcodeScanner.ts`
  - Conecta/desconecta el servicio automáticamente al montar/desmontar
  - Estado `isConnected` reactivo para la UI
  - Soporte `enabled` para pausar/reanudar
  - Callback `onScan` tipado

### Fase 3: Integración POS ✅
- [x] Integrar en `components/sales/sale-form.tsx`
  - Escaneo automático: busca producto por barcode en la lista local
  - Agrega al carrito sin interacción manual
  - Feedback visual: flash verde en la tarjeta del producto (`animate-scan-flash`)
  - Feedback audible: beep agudo en éxito, grave en error (`Web Audio API`)
  - Manejo de productos sin stock y no encontrados

### Fase 4: Indicador de estado ✅
- [x] Crear `components/scanner/components/scanner-status.tsx`
  - Indicador 🟢/🔴 en el header de la venta
  - Animación `ping` en el punto verde cuando conectado
  - Icono `ScanBarcode` de Lucide
  - Dark mode compatible

### Fase 5: Endpoint backend ✅
- [x] `GET /products/barcode/:code`
  - Ruta registrada ANTES de `:id` para evitar conflictos
  - Búsqueda tenant-scoped: `where: { companyId, barcode }`
  - Mismos guards y permisos que el listado de productos
  - Retorna producto completo con categoría

---

## Consideraciones de Seguridad

- **Sanitización**: Validar longitud máxima y caracteres permitidos del código escaneado
- **Tenant isolation**: Toda query incluye `companyId` en el `where`
- **Límites de plan**: `SubscriptionLimitGuard` evita exceder el plan contratado
- **Rate limiting**: 60 req/min por IP (ThrottlerGuard global)
- **Validación Zod**: Esquemas de validación tanto en frontend como backend

---

## Referencias

- [`frontend/components/ui/barcode-scanner.tsx`](/frontend/components/ui/barcode-scanner.tsx) — Componente cámara (implementado)
- [`frontend/components/products/product-form.tsx`](/frontend/components/products/product-form.tsx) — Integración producto (implementado)
- [`frontend/components/sales/sale-form.tsx`](/frontend/components/sales/sale-form.tsx) — POS (HID planeado)
- [`backend/src/modules/products/products.service.ts`](/backend/src/modules/products/products.service.ts) — Lógica backend
- [`backend/src/modules/products/products.controller.ts`](/backend/src/modules/products/products.controller.ts) — Endpoints
- [`frontend/lib/api.ts`](/frontend/lib/api.ts) — Cliente HTTP (`apiFetch`)
- [`docs/barcode-scanner-plan.md`](/docs/barcode-scanner-plan.md) — Plan detallado inicial
