# Módulo de Productos Extendido

## Resumen

Extensiones para el módulo de productos: imagenes, alertas de stock y exportación de datos.

---

## 1. Imagen de Producto

### Schema (ya existe)
```prisma
model Product {
  imageUrl        String?
}
```

### API Endpoint
```
POST   /products/:id/image    - Subir imagen
DELETE /products/:id/image    - Eliminar imagen
```

### Flujo
1. Modal de producto → Input file para imagen
2. Convertir a Base64 o guardar en storage
3. Guardar URL en `Product.imageUrl`

### Frontend
- Preview de imagen en el modal
- Mostrar imagen en la tabla de productos
- Imagen por defecto si no tiene

---

## 2. Alerta de Stock Bajo (Tiempo Real)

### Tipos de Alerta

| Tipo | Condición | Acción |
|------|-----------|---------|
| Stock bajo | `stockQuantity <= minStock` | Notificación al crear/actualizar |
| Stock crítico | `stockQuantity <= minStock / 2` | Notificación inmediata |
| Sin stock | `stockQuantity === 0` | Notificación + deshabilitar venta |

### Implementación

```typescript
// products.service.ts
async checkLowStock(product: Product) {
  if (product.stockQuantity <= 0) {
    // Notificar sin stock
    await this.notificationsService.create({
      type: NotificationType.LOW_STOCK,
      title: 'Producto sin stock',
      message: `${product.name} está agotado`,
    });
  } else if (product.stockQuantity <= product.minStock / 2) {
    // Notificar stock crítico
  } else if (product.stockQuantity <= product.minStock) {
    // Notificar stock bajo
  }
}
```

### Notificaciones por Rol
- COMPANY_ADMIN: Todas las alertas
- MANAGER: Stock bajo y crítico
- CASHIER: Solo sin stock

---

## 3. Exportar Operaciones de Venta

### Formatos Soportados

| Formato | Extensión | Uso |
|---------|-----------|-----|
| CSV | .csv | Excel, Google Sheets |
| Excel | .xlsx | Análisis profundo |
| PDF | .pdf | Reportes, facturas |

### API Endpoints

```
GET /sales/export?format=csv        - Exportar ventas
GET /products/export?format=csv     - Exportar productos
GET /reports/export?format=pdf      - Reporte general
```

### Parámetros
```
?format=csv|xlsx|pdf
&startDate=2024-01-01
&endDate=2024-01-31
&categoryId=xxx
&status=ACTIVE
```

### CSV Structure
```csv
ID,Fecha,Producto,Cantidad,Precio,Total,Cliente,Vendedor
1,2024-01-15,Producto A,2,10.00,20.00,Juan,Pedro
```

### Excel Structure
- Múltiples hojas: Ventas, Productos, Resumen
- Fórmulas para totales
- Formato condicional

### PDF Structure
```
================================
      REPORTE DE VENTAS
================================
Fecha: 15/01/2024
Período: 01/01/2024 - 15/01/2024

--------------------------------
PRODUCTO        CANT   PRECIO   TOTAL
--------------------------------
Producto A         2   S/10    S/20
Producto B         1   S/15    S/15
--------------------------------
TOTAL:                       S/35

================================
```

---

## 4. Dashboard de Stock

### Métricas
- Productos totales
- Productos con stock bajo
- Productos sin stock
- Valor total del inventario

### Alertas Visuales
- Badge rojo en productos sin stock
- Badge amarillo en stock bajo
- Notificación al crear venta

---

## 5. API Completa de Productos

```typescript
// ProductsController
GET    /products                    - Listar productos
GET    /products/:id                - Ver producto
POST   /products                    - Crear producto
PATCH  /products/:id                - Actualizar producto
DELETE /products/:id                - Eliminar producto
POST   /products/:id/image          - Subir imagen
DELETE /products/:id/image          - Eliminar imagen
GET    /products/export?format=csv   - Exportar productos
GET    /products/low-stock           - Productos stock bajo

// Categorías
GET    /products/categories         - Listar categorías
POST   /products/categories        - Crear categoría
PATCH  /products/categories/:id    - Actualizar categoría
DELETE /products/categories/:id   - Eliminar categoría
```

---

## 6. Validaciones

### Crear/Editar Producto
```typescript
- Nombre: requerido, max 200 caracteres
- SKU: único por empresa, requerido
- Precio venta: >= 0
- Precio costo: >= 0
- Stock: >= 0
- Min stock: >= 0
- Categoria: válida
```

### Venta con Stock
```typescript
async function validateSale(saleItems: SaleItem[]) {
  for (const item of saleItems) {
    const product = await getProduct(item.productId);
    
    if (product.stockQuantity < item.quantity) {
      throw new BadRequestException(
        `Stock insuficiente para ${product.name}`
      );
    }
  }
}
```

---

## 7. UI/UX

### Tabla de Productos
- Imagen thumbnail (40x40)
- Nombre del producto
- SKU
- Categoría
- Stock (color según nivel)
- Precio
- Estado (Active/Inactive)
- Acciones (Editar, Eliminar, Ver)

### Badges de Stock
- Verde: `stock > minStock * 1.5`
- Amarillo: `minStock < stock <= minStock * 1.5`
- Rojo: `stock <= minStock`
- Gris: `stock === 0`

### Export Modal
- Seleccionar formato
- Seleccionar columnas
- Filtrar por fecha
- Filtrar por categoría
- Preview antes de descargar
