# Informe de Implementación - Sistema de Permisos RBAC

## Fecha: 16 de Marzo 2026

---

## Resumen

Se implementó un sistema de permisos granulares (RBAC + Permissions) en el backend NestJS, complementando el sistema existente de roles con un control de permisos detallado a nivel de endpoint.

---

## Archivos Creados

### `backend/src/common/constants/permissions.constant.ts`
- Enum `Permission` con 32 permisos granulares organizados por módulo:
  - **Products**: `product:list`, `product:create`, `product:update`, `product:delete`, `product:export`, `product:view_low_stock`
  - **Categories**: `category:list`, `category:create`, `category:update`, `category:delete`
  - **Customers**: `customer:list`, `customer:create`, `customer:update`, `customer:delete`
  - **Employees**: `employee:list`, `employee:create`, `employee:update`, `employee:delete`
  - **Sales**: `sale:list`, `sale:create`, `sale:view_detail`, `sale:cancel`, `sale:export`
  - **Inventory**: `inventory:view`, `inventory:inbound`, `inventory:outbound`, `inventory:adjust`
  - **Cash**: `cash:open_close`, `cash:view_report`
  - **Dashboard/Reports**: `dashboard:view`, `report:sales`, `report:financial`
  - **Company**: `company:view`, `company:update`, `company:manage_plans`, `company:view_audit`, `company:manage_all`
  - **Subscriptions**: `subscription:view`, `subscription:manage`
  - **Users**: `user:manage`
- Constante `ROLE_PERMISSIONS` mapea cada rol a su lista de permisos:
  - `SUPER_ADMIN`: Todos los permisos
  - `COMPANY_ADMIN`: ~30 permisos (excepto `company:manage_all`, `subscription:manage`, `user:manage`)
  - `MANAGER`: ~26 permisos (sin eliminar productos, clientes ni empleados)
  - `CASHIER`: ~12 permisos (operaciones básicas de caja/ventas)
  - `VIEWER`: ~8 permisos (solo lectura)
  - `SUPPORT_ADMIN`: ~5 permisos (gestión de empresas/suscripciones/usuarios)

### `backend/src/common/decorators/permissions.decorator.ts`
- Decorador `@Permissions(...Permission[])` para declarar permisos requeridos en endpoints
- Utiliza `SetMetadata` con clave `'permissions'`

### `backend/src/common/guards/permissions.guard.ts`
- `PermissionsGuard`: Ejecuta después de `RolesGuard`
- Obtiene el rol del usuario desde `request.user.role`
- Busca los permisos asociados a ese rol en `ROLE_PERMISSIONS`
- Verifica que el rol del usuario tenga TODOS los permisos requeridos por el endpoint
- `SUPER_ADMIN` hace bypass automático (tiene todos los permisos)
- Arroja `ForbiddenException` si faltan permisos

---

## Archivos Modificados

### `backend/src/common/guards/roles.guard.ts`
- Eliminados `console.log()` de debug
- Agregado bypass implícito para `SUPER_ADMIN` (no necesita estar enlistado en `@Roles()`)

### `backend/src/modules/products/products.controller.ts`
- Agregados `@Permissions()` + `PermissionsGuard` en:
  - `GET /products` → `PRODUCT_LIST`
  - `GET /products/export` → `PRODUCT_EXPORT`
  - `GET /products/low-stock` → `PRODUCT_VIEW_LOW_STOCK`
  - `POST /products` → `PRODUCT_CREATE`
  - `PATCH /products/:id` → `PRODUCT_UPDATE`
  - `DELETE /products/:id` → `PRODUCT_DELETE`
  - `GET /products/categories` → `CATEGORY_LIST`
  - `POST /products/categories` → `CATEGORY_CREATE`
  - `PATCH /products/categories/:id` → `CATEGORY_UPDATE`
  - `DELETE /products/categories/:id` → `CATEGORY_DELETE`

### `backend/src/modules/sales/sales.controller.ts`
- Agregados `@Permissions()` + `PermissionsGuard` en:
  - `GET /sales` → `SALE_LIST`
  - `GET /sales/export` → `SALE_EXPORT`
  - `POST /sales` → `SALE_CREATE`
  - `GET /sales/:id` → `SALE_VIEW_DETAIL`

### `backend/src/modules/customers/customers.controller.ts`
- Agregados `@Permissions()` + `PermissionsGuard` en:
  - `GET /customers` → `CUSTOMER_LIST`
  - `POST /customers` → `CUSTOMER_CREATE`
  - `PATCH /customers/:id` → `CUSTOMER_UPDATE`
  - `DELETE /customers/:id` → `CUSTOMER_DELETE`

### `backend/src/modules/employees/employees.controller.ts`
- Agregados `@Permissions()` + `PermissionsGuard` en:
  - `GET /employees` → `EMPLOYEE_LIST`
  - `POST /employees` → `EMPLOYEE_CREATE`
  - `PATCH /employees/:id` → `EMPLOYEE_UPDATE`
  - `DELETE /employees/:id` → `EMPLOYEE_DELETE`

### `backend/src/modules/inventory/inventory.controller.ts`
- Agregados `@Permissions()` + `PermissionsGuard` en:
  - `GET /inventory/movements` → `INVENTORY_VIEW`
  - `GET /inventory/low-stock` → `INVENTORY_VIEW`
  - `POST /inventory/adjust` → `INVENTORY_ADJUST`

### `backend/src/modules/companies/companies.controller.ts`
- Agregados `@Permissions()` + `PermissionsGuard` en:
  - `GET /companies/current` → `COMPANY_VIEW`
  - `PATCH /companies/current` → `COMPANY_UPDATE`
  - `GET /companies` → `COMPANY_MANAGE_ALL`
  - `GET /companies/:id` → `COMPANY_MANAGE_ALL`
  - `POST /companies` → `COMPANY_MANAGE_ALL`
  - `POST /companies/with-plan` → `COMPANY_MANAGE_ALL` + `SUBSCRIPTION_MANAGE`
  - `POST /companies/:id/approve` → `COMPANY_MANAGE_ALL`
  - `POST /companies/:id/reject` → `COMPANY_MANAGE_ALL`
  - `PATCH /companies/:id` → `COMPANY_MANAGE_ALL`
  - `PATCH /companies/:id/status` → `COMPANY_MANAGE_ALL`

---

## Arquitectura de Autorización (2 Capas)

1. **RolesGuard** (1ª capa): Verifica que el rol del usuario esté en la lista blanca del endpoint (`@Roles()`). `SUPER_ADMIN` tiene bypass automático.
2. **PermissionsGuard** (2ª capa): Verifica que el rol del usuario tenga los permisos específicos del endpoint (`@Permissions()`). `SUPER_ADMIN` tiene bypass automático.

Ambos guards deben estar siempre juntos. El orden de ejecución es `RolesGuard` primero, luego `PermissionsGuard`.

---

## Matriz de Permisos por Rol

| Categoría | Permiso | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | VIEWER | SUPPORT_ADMIN |
|-----------|---------|:-----------:|:-------------:|:-------:|:-------:|:------:|:-------------:|
| **Products** | list | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| | create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | update | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| | export | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | view_low_stock | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Categories** | list | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | update | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Customers** | list | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| | create | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| | update | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| | delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Employees** | list | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | update | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| | delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Sales** | list | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| | create | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| | view_detail | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| | cancel | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | export | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Inventory** | view | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | inbound | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | outbound | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | adjust | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Cash** | open_close | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| | view_report | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Dashboard** | view | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Reports** | sales | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| | financial | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Company** | view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | update | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| | manage_all | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Subscriptions** | view | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| | manage | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Users** | manage | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Verificación

- ✅ TypeScript build (backend): `npm run build` → sin errores

---

## Pendientes

- Sincronizar el frontend (`frontend/types/permissions.ts`) con los nuevos permisos del backend
- Implementar `PermissionGuard` en componentes del frontend para UI condicional
- Auditoría: endpoints que aun no tienen `PermissionsGuard` (dashboard, cash, subscriptions, users)
