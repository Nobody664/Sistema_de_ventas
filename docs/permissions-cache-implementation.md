# Implementación: Sistema de Permisos y Cache

## Fecha: 2026-03-10

---

## 1. Tipos Centralizados de API

**Archivo:** `frontend/types/api.ts`

```typescript
export type Product = { id, name, sku, barcode, description, costPrice, salePrice, stockQuantity, minStock, status, categoryId, category?, createdAt, updatedAt };
export type Category = { id, name, slug, description, _count? };
export type Customer = { id, firstName, lastName, email, phone, documentType, documentValue, notes, totalPurchases, createdAt };
export type Employee = { id, firstName, lastName, email, phone, role, isActive, createdAt, user? };
export type Sale = { id, saleNumber, totalAmount, subtotal, taxAmount, discountAmount, paymentMethod, status, paidAt, customer?, employee?, items };
```

---

## 2. Hooks de Datos con React Query

**Archivo:** `frontend/hooks/useData.ts`

```typescript
// Hooks de consulta con cache (staleTime: 5 minutos)
export function useProducts()
export function useCategories()
export function useCustomers()
export function useEmployees()
export function useSales()

// Funciones para invalidar cache
export function useInvalidateProducts()
export function useInvalidateCategories()
export function useInvalidateCustomers()
export function useInvalidateEmployees()
export function useInvalidateSales()
```

---

## 3. Componentes de Acciones con Permisos

### Products
- **Archivo:** `frontend/components/products/product-actions.tsx`
- Exporta: `ProductActions`, `NewProductButton`

### Customers
- **Archivo:** `frontend/components/customers/customer-actions.tsx`
- Exporta: `CustomerActions`, `NewCustomerButton`

### Employees
- **Archivo:** `frontend/components/employees/employee-actions.tsx`
- Exporta: `EmployeeActions`, `NewEmployeeButton`

### Categories
- **Archivo:** `frontend/components/categories/category-actions.tsx`
- Exporta: `CategoryActions`, `NewCategoryButton`

---

## 4. Modales con Invalidación de Cache

Todos los modales ahora usan `queryClient.invalidateQueries()` en lugar de `router.refresh()`:

| Archivo | Query invalidada |
|---------|-----------------|
| `product-modal.tsx` | `['products']` |
| `customer-modal.tsx` | `['customers']` |
| `employee-modal.tsx` | `['employees']` |
| `category-modal.tsx` | `['categories']` |
| `delete-dialog.tsx` | Según entidad (products, customers, employees, categories, sales) |

---

## 5. Páginas Actualizadas

- `app/(dashboard)/products/page.tsx` - Usa tipos de api.ts y componentes de acciones
- `app/(dashboard)/customers/page.tsx` - Usa tipos de api.ts y componentes de acciones
- `app/(dashboard)/employees/page.tsx` - Usa tipos de api.ts y componentes de acciones
- `app/(dashboard)/categories/page.tsx` - Usa tipos de api.ts y componentes de acciones

---

## 6. Permisos por Rol

Los permisos ya estaban configurados en `types/permissions.ts`:

| Permiso | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|---------|-------------|---------------|---------|---------|-------|
| products:create | ✅ | ✅ | ✅ | ❌ | ❌ |
| products:delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| categories:create | ✅ | ✅ | ✅ | ❌ | ❌ |
| categories:delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| customers:create | ✅ | ✅ | ✅ | ✅ | ❌ |
| customers:delete | ✅ | ✅ | ✅ | ❌ | ❌ |
| employees:create | ✅ | ✅ | ✅ | ❌ | ❌ |
| employees:delete | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 7. Cómo Funciona el Sistema

### Visualización de botones según permisos
```tsx
<PermissionGuard permission="products:delete" fallback={null}>
  <DeleteDialog id={product.id} entity="product" />
</PermissionGuard>
```

### Invalidación de cache tras mutation
```tsx
const queryClient = useQueryClient();
await apiFetch(...);
queryClient.invalidateQueries({ queryKey: ['products'] });
```

---

## Archivos Creados/Modificados

### Nuevos
- `frontend/types/api.ts`
- `frontend/hooks/useData.ts`
- `frontend/components/products/product-actions.tsx`
- `frontend/components/customers/customer-actions.tsx`
- `frontend/components/employees/employee-actions.tsx`
- `frontend/components/categories/category-actions.tsx`

### Modificados
- `frontend/components/products/product-modal.tsx`
- `frontend/components/customers/customer-modal.tsx`
- `frontend/components/employees/employee-modal.tsx`
- `frontend/components/categories/category-modal.tsx`
- `frontend/components/common/delete-dialog.tsx`
- `frontend/app/(dashboard)/products/page.tsx`
- `frontend/app/(dashboard)/customers/page.tsx`
- `frontend/app/(dashboard)/employees/page.tsx`
- `frontend/app/(dashboard)/categories/page.tsx`

---

## Notas

- Los errores de LSP (editor) se resuelven reiniciando VS Code
- El cache de React Query reduce recargas innecesarias
- Los permisos ocultan botones según el rol del usuario
