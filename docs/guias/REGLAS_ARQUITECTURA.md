# Reglas de Arquitectura y Diseño

## Estado de la Aplicación

### Herramientas de Estado Recomendadas

| Tipo de Estado | Herramienta | Justificación |
|---------------|------------|---------------|
| Estado global de UI | **Zustand** | Ligero, compatible con Next.js App Router, API simple (~1.1kb) |
| Estado del servidor | **React Query (TanStack Query)** | Gestión de caché, invalidación automática, prefetching |
| Estado del formulario | **React Hook Form + Zod** | Validación declarativa, performance optimizado |
| Estado local | **useState/useReducer** | Suficiente para estados simples dentro de componentes |

### Por qué Zustand?

- **Tamaño mínimo**: ~1.1kb gzipped
- **Next.js compatible**: Funciona con Server Components y Client Components
- **Sin boilerplate**: API simple basada en hooks
- **Persistencia**: Middleware para localStorage/sessionStorage
- **TypeScript**: Soporte nativo y excelente inferencia de tipos

### Estructura de Stores

```
frontend/src/store/
├── ui-store.ts          # Estado global de UI (toasts, modals, sidebar)
├── auth-store.ts         # Estado de autenticación (opcional)
└── [feature]-store.ts   # Stores específicos por feature
```

---

## Formularios

### Regla Principal: Páginas Dedicadas

**Los formularios siempre deben tener sus propias páginas dedicadas**, no deben estar dentro de modales.

### Estructura de URLs

| Recurso | Crear | Editar |
|---------|-------|--------|
| Producto | `/products/new` | `/products/[id]/edit` |
| Cliente | `/customers/new` | `/customers/[id]/edit` |
| Empleado | `/employees/new` | `/employees/[id]/edit` |
| Categoría | `/categories/new` | `/categories/[id]/edit` |

### Patrón de Página de Formulario

```typescript
// app/(dashboard)/products/new/page.tsx
export default function NewProductPage() {
  return <ProductFormPage />;
}

// app/(dashboard)/products/[id]/edit/page.tsx
export default function EditProductPage({ params }) {
  return <ProductFormPage productId={params.id} />;
}

// components/products/product-form.tsx (componente compartido)
export function ProductFormPage({ productId?: string }) {
  // Lógica del formulario
}
``` 

### Validación con Zod

```typescript
// lib/validations/product.validation.ts
import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.coerce.number().min(0, 'El precio debe ser positivo'),
  salePrice: z.coerce.number().min(0, 'El precio debe ser positivo'),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(5),
  categoryId: z.string().optional(),
  imageUrl: z.string().optional(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
```

---

## Componentes

### Tipos de Componentes

| Tipo | Ubicación | Uso |
|------|-----------|-----|
| Server Components | `app/**/page.tsx` | Fetching de datos, SEO, renderizado inicial |
| Client Components | `components/**/*.tsx` | Interactividad, estado, event handlers |
| Form Components | `components/[feature]/[feature]-form.tsx` | Lógica de formularios |

### Reglas de Composición

1. **Server Components** delegan a **Client Components** cuando necesitan interactividad
2. **Forms** siempre son Client Components (usan hooks)
3. **No mezclar**: Un componente o es server o es client, no ambos

---

## Estilo y Diseño

### Sistema de Diseño

- **Componentes base**: shadcn/ui
- **Estilos**: Tailwind CSS
- **Tipografía**: Variables CSS personalizadas (evitar valores hardcoded)

### Paleta de Colores

El proyecto usa una paleta de colores profesional:

| Color | Uso | Valor |
|-------|-----|-------|
| Primary | Botones principales, acentos | Emerald 500 (#10b981) |
| Background | Fondo principal | Cream (#fbf6ef) |
| Sidebar | Navegación lateral | Dark slate (#0d1520) |
| Text | Texto principal | Slate 900 (#0f172a) |
| Muted | Texto secundario | Slate 500 (#64748b) |

### Espaciado

- **Base**: 4px (tailwind: 1)
- **Componentes**: 16px-24px (p-4, p-6)
- **Secciones**: 32px-48px (p-8, gap-8)
- **Page padding**: 20px móvil, 32px desktop (p-5 md:p-8)

---

## API y Backend

### Patrón de Fetch

```typescript
// Usar apiFetch helper
const data = await apiFetch('/products', {
  token: session?.accessToken,
});
```

### Invalidación de Cache

```typescript
// After mutations
queryClient.invalidateQueries({ queryKey: ['products'] });
router.refresh(); // Actualiza Server Components
```

---

## Nomenclatura

### Archivos

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Componentes | kebab-case | `product-modal.tsx` |
| Pages | kebab-case | `new-product-page.tsx` |
| Validations | kebab-case | `product.validation.ts` |
| DTOs | PascalCase | `CreateProductDto` |
| Tipos | PascalCase | `ProductFormProps` |

### Rutas

- **Singular**: `/product`, `/customer` (para recursos individuales)
- **Plural**: `/products`, `/customers` (para colecciones)
- **Acciones**: `/products/new`, `/products/[id]/edit`

---

## Seguridad

### Validación

- **Siempre**: Zod en el frontend Y backend
- **Nunca**: Confiar en datos del cliente
- **Sanitización**: Limpiar inputs antes de enviar

### Autenticación

- Proteger todas las rutas en `layout.tsx`
- Usar `auth()` de NextAuth para verificar sesión
- Roles verificados en backend Y frontend

---

## Rendimiento

### Optimizaciones

1. **Imágenes**: Usar `next/image` con sizes apropiados
2. **Fuentes**: `next/font` para evitar CLS
3. **Carga**: Code splitting automático con Next.js
4. **Prefetch**: Links con prefetch habilitado (default)

### Evitar

- `useEffect` para fetching de datos (usar React Query)
- Estados duplicados (fuente única de verdad)
- Re-renders innecesarios (use memo/selectors)

---

## Git y versionado

### Commits

- **feat**: Nueva funcionalidad
- **fix**: Corrección de bug
- **refactor**: Refactorización sin cambio de comportamiento
- **docs**: Documentación
- **style**: Cambios de diseño (sin lógica)

### Ramas

- `main`: Producción
- `develop`: Desarrollo
- `feature/*`: Nuevas funcionalidades
- `fix/*`: Correcciones
