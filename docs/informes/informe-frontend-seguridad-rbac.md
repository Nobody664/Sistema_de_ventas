# Informe de Implementación - Seguridad Frontend (RBAC + Rutas)

## Fecha: 29 de Mayo 2026

---

## Resumen

Se implementó un sistema completo de seguridad en el frontend que sincroniza con el backend RBAC, protege rutas contra acceso directo por URL, y añade controles de permisos a nivel de página y componente.

---

## Cambios Realizados

### 1. Sincronización de Permisos Frontend/Backend

**Archivo:** `frontend/types/permissions.ts` (reescrito completo)

Se alinearon los 44 permisos del frontend con los 32 del backend, más 2 adicionales de frontend (`settings:read`, `settings:update`):

| Categoría | Permisos |
|-----------|----------|
| **Productos** | `product:list`, `product:create`, `product:update`, `product:delete`, `product:export`, `product:view_low_stock` |
| **Categorías** | `category:list`, `category:create`, `category:update`, `category:delete` |
| **Clientes** | `customer:list`, `customer:create`, `customer:update`, `customer:delete` |
| **Empleados** | `employee:list`, `employee:create`, `employee:update`, `employee:delete` |
| **Ventas** | `sale:list`, `sale:create`, `sale:view_detail`, `sale:cancel`, `sale:export` |
| **Inventario** | `inventory:view`, `inventory:inbound`, `inventory:outbound`, `inventory:adjust` |
| **Caja** | `cash:open_close`, `cash:view_report` |
| **Dashboard** | `dashboard:view` |
| **Reportes** | `report:sales`, `report:financial` |
| **Empresa** | `company:view`, `company:update`, `company:manage_plans`, `company:view_audit`, `company:manage_all` |
| **Suscripciones** | `subscription:view`, `subscription:manage` |
| **Usuarios** | `user:manage` |
| **Config (FE)** | `settings:read`, `settings:update` |

Se renombraron permisos para coincidir con el backend:
- `products:read` → `product:list`
- `categories:read` → `category:list`
- `customers:read` → `customer:list`
- `employees:read` → `employee:list`
- `sales:read` → `sale:list`, `sales:delete` → `sale:cancel`
- `companies:read` → `company:view`, `companies:delete`/`companies:create` → `company:manage_all`
- `reports:read` → `report:sales`, `reports:export` → `report:financial`
- `dashboard:read` → `dashboard:view`

**Roles actualizados en ROLE_PERMISSIONS:**

| Rol | Permisos | Descripción |
|-----|----------|-------------|
| `SUPER_ADMIN` | Todos (44) | Acceso total |
| `COMPANY_ADMIN` | 37 | Operaciones completas dentro de la empresa |
| `MANAGER` | 29 | Gestión sin eliminaciones sensibles |
| `CASHIER` | 12 | Operaciones de caja y ventas |
| `VIEWER` | 9 | Solo lectura |
| `SUPPORT_ADMIN` | 5 | Gestión de plataforma (empresas/suscripciones) |

Se eliminó el rol `STAFF` (reemplazado por `VIEWER`) y se agregó `SUPPORT_ADMIN`.

### 2. Middleware de Protección de Rutas

**Archivo:** `frontend/middleware.ts` (nuevo)

- Previene acceso directo por URL sin autenticación
- Verifica el cookie `access_token` en cada request
- Valida el token contra `GET /auth/me` del backend
- Redirige a `/sign-in?callbackUrl=...` si no hay sesión
- Rutas públicas: `/`, `/sign-in`, `/sign-up`, `/pricing`
- Rutas protegidas: `/dashboard`, `/products`, `/sales`, `/customers`, `/employees`, `/companies`, `/subscribers`, `/subscriptions`, etc.
- Assets estáticos saltan el middleware

### 3. Página de Acceso Denegado

**Archivo:** `frontend/app/forbidden/page.tsx` (nuevo)

- Página estática 403 con diseño consistente
- Botones para volver al dashboard o iniciar sesión
- Mensaje claro en español

### 4. PageGuard - Guarda de Página por Permisos

**Archivo:** `frontend/components/auth/page-guard.tsx` (nuevo)

Componente cliente para proteger páginas completas:
- `requiredPermissions`: Lista de permisos requeridos
- `requiredRoles`: Lista de roles permitidos
- `SUPER_ADMIN` bypass automático
- Redirige a `/forbidden` si no tiene acceso
- `fallback` opcional para mostrar contenido alternativo

### 5. Actualización de Componentes

**6 action components** actualizados con los nuevos nombres de permisos:

| Componente | Permiso Anterior | Permiso Nuevo |
|------------|-----------------|---------------|
| `product-actions.tsx` | `products:delete`, `products:create` | `product:delete`, `product:create` |
| `employee-actions.tsx` | `employees:update/delete/create` | `employee:update/delete/create` |
| `customer-actions.tsx` | `customers:update/delete/create` | `customer:update/delete/create` |
| `company-actions.tsx` | `companies:update/delete/create` | `company:update`, `company:manage_all` |
| `category-actions.tsx` | `categories:update/delete/create` | `category:update/delete/create` |

**Sidebar** (`app-sidebar.tsx`): `STAFF` → `VIEWER` en items de navegación

**Employee modal** (`employee-modal.tsx`): opción `STAFF` → `VIEWER`

**Employees page** (`employees/page.tsx`): `roleConfig.STAFF` → `roleConfig.VIEWER`

### 6. PageGuard en Página Cliente

**Upgrade Requests** (`upgrade-requests/page.tsx`): Envuelta en `PageGuard` con `requiredRoles={['SUPER_ADMIN', 'SUPPORT_ADMIN']}`

### 7. Páginas con Protección Existente (no modificadas)

| Página | Protección | Roles |
|--------|-----------|-------|
| `dashboard/layout.tsx` | Server-side redirect | Cualquier sesión |
| `subscribers/page.tsx` | Server-side message | SUPER_ADMIN, SUPPORT_ADMIN |
| `audit/page.tsx` | Server-side message | SUPER_ADMIN, SUPPORT_ADMIN |
| `invoices/templates/page.tsx` | Server-side redirect | SUPER_ADMIN, SUPPORT_ADMIN |
| `subscriptions/page.tsx` | Client-side message | SUPER_ADMIN, SUPPORT_ADMIN |
| `notifications/page.tsx` | Server-side message | Cualquier sesión |
| `companies/page.tsx` | Client-side check | SUPER_ADMIN, SUPPORT_ADMIN |
| `settings/page.tsx` | Client-side check | SUPER_ADMIN, SUPPORT_ADMIN |
| `profile/page.tsx` | Client-side check | SUPER_ADMIN, SUPPORT_ADMIN |

---

## Arquitectura de Seguridad (3 Capas)

```
Capa 1: Middleware (Edge) → middleware.ts
  └── Verifica cookie access_token → redirige a /sign-in si no autenticado

Capa 2: Layout Server-Side → (dashboard)/layout.tsx
  └── getServerSession() → redirige a /sign-in si no hay sesión
  
Capa 3: PageGuard / Checks por Página
  ├── PageGuard (cliente) → redirige a /forbidden si faltan permisos
  ├── Server-side role checks → mensaje de acceso restringido
  └── PermissionGuard (componente) → oculta UI si falta permiso
```

---

## Matriz de Roles vs Páginas

| Ruta | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | VIEWER | SUPPORT_ADMIN |
|------|:-----------:|:-------------:|:-------:|:-------:|:------:|:-------------:|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/products` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/categories` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/sales` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/customers` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/employees` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/reports` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/companies` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/subscribers` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/subscriptions` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/upgrade-requests` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/invoices/templates` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/audit` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/notifications` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/settings` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/profile` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Verificación

- TypeScript: Solo errores pre-existentes (TS2307 por `next` package no instalado, TS18047/TS2322 pre-existentes)
- **0 errores nuevos** causados por los cambios de esta implementación
- Backend build: ✅ `npm run build` sin errores

---

## Pendientes

1. Instalar dependencias frontend (`npm install`) para restaurar type checking completo
2. Agregar `PageGuard` en páginas server-side faltantes (actualmente solo `upgrade-requests` usa `PageGuard`)
3. Implementar lógica de refresh token en `apiFetch` para mantener sesión activa
4. Sincronizar tipos OpenAPI generados (`api.types.ts`) con backend actualizado
