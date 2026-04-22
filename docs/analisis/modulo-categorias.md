# Módulo de Categorías

## Resumen

El módulo de categorías permite gestionar las categorías de productos para una empresa.

## Frontend

### Rutas
| Ruta | Descripción |
|------|-------------|
| `/categories` | Lista todas las categorías |
| `/categories/new` | Crear nueva categoría |
| `/categories/[id]/edit` | Editar categoría |

### Componentes
| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/categories/page.tsx` | Página principal - lista categorías |
| `app/(dashboard)/categories/new/page.tsx` | Página para crear categoría |
| `app/(dashboard)/categories/[id]/edit/page.tsx` | Página para editar categoría |
| `components/categories/category-form.tsx` | Formulario de categoría (crear/editar) |
| `components/categories/category-actions.tsx` | Acciones (editar, eliminar) |

### API Endpoints
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/products/categories` | Lista categorías |
| GET | `/products/categories/:id` | Obtiene una categoría |
| POST | `/products/categories` | Crea categoría |
| PATCH | `/products/categories/:id` | Actualiza categoría |
| DELETE | `/products/categories/:id` | Elimina categoría |

## Backend

### Controlador
`backend/src/modules/products/products.controller.ts`

### Servicio
`backend/src/modules/products/products.service.ts`

### Validaciones
1. **Crear**: Verifica límite de categorías del plan
2. **Crear**: Verifica que no exista categoría con el mismo nombre
3. **Eliminar**: Verifica que no haya productos asociados

## Problemas Resueltos

1. ✅ Endpoint incorrecto - Corregido de `/categories` a `/products/categories`
2. ✅ Categorías no aparecen tras crear - Agregado `router.refresh()`
3. ✅ Eliminación con productos - Validación en backend + UI deshabilitada

## Permisos por Rol

| Rol | Crear | Editar | Eliminar |
|-----|-------|--------|----------|
| COMPANY_ADMIN | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ❌ |
| CASHIER | ❌ | ❌ | ❌ |
| STAFF | ❌ | ❌ | ❌ |