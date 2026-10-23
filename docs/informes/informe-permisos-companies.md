# Informe de Cambios - Permisos y CRUD de Companies

## Fecha: 10 de Marzo 2026

---

## 1. Permisos de Categorías

Los permisos de categorías ya estaban correctamente implementados en el frontend:

### Archivos verificados:
- `frontend/types/permissions.ts` - Definidos permisos:
  - `categories:read`
  - `categories:create`
  - `categories:update`
  - `categories:delete`

- `frontend/components/categories/category-actions.tsx` - Usa `PermissionGuard` para proteger las acciones de editar y eliminar

- `frontend/components/categories/category-modal.tsx` - CRUD completo de categorías con Create y Update

- `backend/src/modules/products/products.controller.ts` - Endpoints necesarios:
  - `GET /products/categories` - Listar categorías
  - `POST /products/categories` - Crear categoría
  - `PATCH /products/categories/:id` - Actualizar categoría
  - `DELETE /products/categories/:id` - Eliminar categoría

---

## 2. CRUD de Companies (Admin Company)

### Frontend

#### Archivos modificados:

**`frontend/types/permissions.ts`**
- Agregados permisos de companies:
  - `companies:read`
  - `companies:create`
  - `companies:update`
  - `companies:delete`
- Agregados permisos a `ROLE_PERMISSIONS` para `SUPER_ADMIN`

**`frontend/types/api.ts`**
- Agregado tipo `Company` con campos:
  - id, name, slug, email, phone, status, currency, timezone
  - subscription, _count

#### Archivos creados:

**`frontend/components/companies/company-modal.tsx`**
- Modal para crear y editar empresas
- Campos: nombre, email, teléfono, moneda, zona horaria
- Usa `apiFetch` y `useQueryClient` para invalidar cache

**`frontend/components/companies/company-actions.tsx`**
- `CompanyActions`: Componente para editar y cambiar estado de empresa
- `NewCompanyButton`: Botón para nueva empresa con permisos
- Manejo de activación/suspensión de empresas

**`frontend/app/(dashboard)/companies/page.tsx`**
- Actualizada para usar los nuevos componentes
- Muestra empresas con cards incluyendo:
  - Nombre, slug, estado, email, teléfono
  - Fecha de creación
  - Contador de usuarios y clientes
  - Plan de suscripción
- Botón "Nueva empresa" con permisos

### Backend

#### Archivos modificados:

**`backend/src/modules/companies/companies.controller.ts`**
- Agregados endpoints:
  - `GET /companies/:id` - Obtener empresa por ID
  - `POST /companies` - Crear empresa
  - `PATCH /companies/:id` - Actualizar empresa

**`backend/src/modules/companies/companies.service.ts`**
- Agregados métodos:
  - `findOne(id)` - Buscar empresa por ID
  - `create(input)` - Crear empresa
  - `update(id, input)` - Actualizar empresa

**`backend/src/modules/companies/dto/company.dto.ts`**
- Agregado `CreateCompanyDto` con validaciones:
  - name (requerido)
  - slug (opcional)
  - email (opcional)
  - phone (opcional)
  - timezone (opcional, default: America/Lima)
  - currency (opcional, default: PEN)

---

## Verificaciones

- ✅ Backend lint passes: `npm run lint`
- ✅ Frontend lint passes: `npm run lint`

---

## Roles y Permisos

| Rol | companies:read | companies:create | companies:update | companies:delete |
|-----|----------------|------------------|------------------|------------------|
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ |
| COMPANY_ADMIN | ❌ | ❌ | ❌ | ❌ |
| MANAGER | ❌ | ❌ | ❌ | ❌ |
| CASHIER | ❌ | ❌ | ❌ | ❌ |

Solo SUPER_ADMIN tiene acceso a la gestión de empresas.
