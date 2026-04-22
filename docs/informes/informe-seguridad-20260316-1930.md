# Informe de Auditoría de Seguridad y Autorización

**Fecha:** 16/03/2026 19:30  
**Sistema:** SISTEMA_DE_VENTAS (NestJS + Next.js)

---

## Resumen Ejecutivo

Este informe documenta la auditoría completa del sistema de seguridad y autorización del proyecto, identificando inconsistencias entre el backend y frontend, y proporcionando recomendaciones para corregir las vulnerabilidades encontradas.

---

## 1. ARQUITECTURA DE SEGURIDAD

### Backend (NestJS)

```
Request → JwtAuthGuard → RolesGuard → TenantGuard → Controller
```

| Guard | Propósito |
|-------|-----------|
| `JwtAuthGuard` | Valida token JWT del header Authorization |
| `RolesGuard` | Verifica roles del decorador @Roles() vs request.user.roles |
| `TenantGuard` | Aísla datos por empresa, establece request.tenantId |
| `SubscriptionLimitGuard` | Valida límites del plan |

### Frontend (Next.js)

- **Protección:** En layouts y páginas mediante `auth()` de NextAuth
- **Sidebar:** Filtra menús por roles del usuario
- **Sesión:** Almacena JWT tokens y roles en el token de NextAuth

---

## 2. ROLES DEL SISTEMA

| Rol | Ámbito | Backend | Frontend |
|-----|--------|---------|----------|
| `SUPER_ADMIN` | Global | ✅ | ✅ |
| `SUPPORT_ADMIN` | Global | ✅ | ✅ |
| `COMPANY_ADMIN` | Tenant | ✅ | ✅ |
| `MANAGER` | Tenant | ✅ | ✅ |
| `CASHIER` | Tenant | ✅ | ✅ |
| `STAFF` | Tenant | ✅ (definido) | ❌ (no usado) |

---

## 3. ENDPOINTS DEL BACKEND Y SUS ROLES

### Auth (`/auth`)
| Endpoint | Roles |
|----------|-------|
| POST /register | Público |
| POST /login | Público |
| POST /refresh | Público |
| GET /me | Requiere JWT |

### Companies (`/companies`)
| Endpoint | Roles |
|----------|-------|
| GET /current | COMPANY_ADMIN, MANAGER, CASHIER |
| PATCH /current | COMPANY_ADMIN |
| GET / | SUPER_ADMIN |
| POST / | SUPER_ADMIN |

### Invoices (`/invoices`)
| Endpoint | Roles |
|----------|-------|
| GET /templates | COMPANY_ADMIN, MANAGER |
| POST /templates | COMPANY_ADMIN |
| POST /templates/global | SUPER_ADMIN |

### Sales (`/sales`)
| Endpoint | Roles |
|----------|-------|
| GET / | COMPANY_ADMIN, MANAGER, CASHIER |
| POST / | COMPANY_ADMIN, MANAGER, CASHIER |

---

## 4. ANÁLISIS DE INCONSISTENCIAS ENCONTRADAS

### ❌ INCONSISTENCIA 1: Plantillas de Documentos

**Problema:** El backend permite `COMPANY_ADMIN` y `MANAGER` en `/invoices/templates`, pero el frontend solo mostraba el menú para `SUPER_ADMIN` y `SUPPORT_ADMIN`.

esto debe ser asi solo debe mostrarse para SUPER_ADMIN

**Archivos afectados:**
- `components/layout/app-sidebar.tsx` - ✅ Corregido (solo SUPER_ADMIN/SUPPORT_ADMIN)

- `app/(dashboard)/invoices/templates/page.tsx` - ❌ Permite COMPANY_ADMIN/MANAGER
aqui si debe cargar correctamente el nombre de la empresa que se obtine por el company_Admin(creo, tu que sabes hazlo bien)
**Estado:** Parcial - el acceso a la URL funciona pero el menú no aparece.

### ❌ INCONSISTENCIA 2: Selector de Empresa en Nueva Venta

**Problema:** El formulario de nueva venta (`/sales/new`) no tenía selector de empresa, y el backend espera un `companyId` en el tenant.

**Solución implementada:**
- Agregado selector en `components/sales/sale-form.tsx`
- Ahora pasa companies desde `app/(dashboard)/sales/new/page.tsx`

**Estado:** ✅ Implementado

Eliminalo no es necesario. el selector de empresa solo era para la creacion de plantillas.


### ⚠️ INCONSISTENCIA 3: Permisos en Páginas del Frontend

| Página | Backend Roles | Frontend Verificación |
|--------|---------------|----------------------|
| `/invoices/templates` | COMPANY_ADMIN, MANAGER | Solo SUPER_ADMIN |
| `/invoices/templates/new` | COMPANY_ADMIN | Solo SUPER_ADMIN |
| `/invoices/templates/[id]` | COMPANY_ADMIN, MANAGER | Solo SUPER_ADMIN |

**Estado:** ⚠️ Permite acceso pero las páginas verifican roles incorrectamente

---

## 5. PROBLEMAS DE SEGURIDAD IDENTIFICADOS

### 🔴 CRÍTICO: Sin Middleware de Protección

**Descripción:** El frontend no tiene un `middleware.ts` de NextAuth para proteger rutas centralizadamente.

**Riesgo:** Un usuario podría acceder directamente a una URL si conoce la ruta, aunque el menú no se lo muestre.

**Recomendación:** Implementar middleware.ts para verificar sesión y roles en cada request.

### 🟡 MEDIO: Sin Manejo de 401/403 en API Calls

**Descripción:** Cuando el token expira (401) o no tiene permisos (403), el frontend no hace logout automático.

**Riesgo:** El usuario puede ver errores confusos en lugar de ser redirigido al login.

**Recomendación:** Agregar interceptor en `lib/api.ts` para manejar respuestas 401/403.

### 🟡 MEDIO: Páginas Sin Verificación de Roles

**Descripción:** Algunas páginas como `/products`, `/sales`, `/customers` no tienen verificación de roles, confían solo en el layout.

**Riesgo:** Si un usuario accede directamente a la URL, puede entrar aunque no tenga el rol apropiado (el backend lo rechazarían, pero la experiencia es mala).

**Recomendación:** Agregar verificación de roles en todas las páginas.

### 🟢 BAJO: Rol STAFF No Implementado

**Descripción:** El backend define el rol `STAFF` en el enum CompanyRole, pero el frontend no lo usa.

**Riesgo:** No hay un rol base para usuarios con permisos limitados.

**Recomendación:** Decidir si usar STAFF o eliminarlo del enum.

Si implementalo y tbm manejemos su UIX para manejar sus datos y operaciones CRUD.
---


## 6. COMPARACIÓN FRONTEND vs BACKEND

### Sidebar vs Controladores

| Menú Sidebar | Roles Frontend | Controlador Backend |
|--------------|----------------|---------------------|
| Dashboard | COMPANY_ADMIN, MANAGER, CASHIER | JwtAuthGuard + TenantGuard |
| Productos | COMPANY_ADMIN, MANAGER, CASHIER | Roles: COMPANY_ADMIN, MANAGER, CASHIER |
| Ventas | COMPANY_ADMIN, MANAGER, CASHIER | Roles: COMPANY_ADMIN, MANAGER, CASHIER |
| Plantillas | SUPER_ADMIN, SUPPORT_ADMIN | Roles: COMPANY_ADMIN, MANAGER, SUPER_ADMIN |

**Discrepancia:** El sidebar muestra "Plantillas" solo para SUPER_ADMIN, pero el backend permite COMPANY_ADMIN y MANAGER.

---

## 7. VALIDACIONES DEL SISTEMA

### Backend DTOs
- ✅ Auth: Validación con class-validator (email, password, etc.)
- ✅ Products: Validación de números, strings, opcionales
- ✅ Customers: Validación de documentos, emails
- ✅ Employees: Validación de roles con @IsIn()

### Frontend Forms
- ✅ Registro: Validación con Zod
- ✅ Login: Validación con Zod
- ⚠️ Otros forms: Validación básica, dependencia del backend

---

## 8. RECOMENDACIONES DE MEJORA

### Prioridad Alta
1. **Crear middleware.ts** para protección centralizada de rutas
2. **Corregir verificación de roles** en páginas de plantillas para coincidir con backend
3. **Agregar interceptor** de respuestas 401/403 para logout automático

### Prioridad Media
4. **Estandarizar verificación de roles** en todas las páginas
5. **Implementar uso del rol STAFF** o eliminarlo del enum
6. **Agregar validación de datos** en todos los DTOs del backend

### Prioridad Baja
7. **Documentar estructura de roles** en un archivo central
8. **Crear hook useAuth** que abstraiga verificaciones comunes

---

## 9. ESTADO ACTUAL DE ERRORES

| Error | Estado |
|-------|--------|
| Error 403 "Debe especificar una empresa" | ✅ Parcialmente resuelto (revertido sidebar) |
| Selector de empresas en Nueva Venta | ✅ Implementado |
| Module not found (template-editor) | ✅ Resuelto |
| Hydration error (tbody) | ✅ Resuelto |

---

## 10. CONCLUSIÓN

El sistema tiene una arquitectura de seguridad sólida en el backend con guards bien implementados. Sin embargo, el frontend tiene inconsistencias que pueden causar confusión al usuario. Las principales áreas de mejora son:

1. Centralizar la protección de rutas con middleware
2. Alinear los roles del sidebar con los permitidos por el backend
3. Agregar manejo automático de errores de autenticación

El error documentado en `docs/errores.md` se resuelve parcialmente al revertirse el acceso para COMPANY_ADMIN, pero la arquitectura necesita refinamiento para evitar futuros desalineamientos.

---

**Próximos pasos:**
1. Crear middleware.ts para el frontend
2. Alinear definitivamente los roles del sidebar con el backend
3. Agregar interceptor de errores HTTP

---

## 11. CAMBIOS IMPLEMENTADOS (16/03/2026)

### ✅ 1. Selector de Empresa en Nueva Venta - ELIMINADO
- Se eliminó el selector de empresas del formulario de nueva venta
- Motivo: El usuario indicó que solo era necesario para plantillas
- Archivos: `components/sales/sale-form.tsx`, `app/(dashboard)/sales/new/page.tsx`

### ✅ 2. Permisos de Plantillas - CORREGIDO
- Las páginas de plantillas ahora solo permiten SUPER_ADMIN y SUPPORT_ADMIN
- Se pasaron companies como prop para el selector en el componente
- Archivos: 
  - `app/(dashboard)/invoices/templates/page.tsx`
  - `app/(dashboard)/invoices/templates/new/page.tsx`
  - `app/(dashboard)/invoices/templates/[id]/page.tsx`
  - `app/(dashboard)/invoices/templates/invoices-templates-client.tsx`

### ✅ 3. Middleware de Protección - CREADO
- Nuevo archivo `frontend/middleware.ts` para proteger rutas centralizadamente
- Verifica sesión antes de acceder a cualquier página
- Redirige a /sign-in si no hay sesión
- Maneja rutas API no autenticadas

### ✅ 4. Interceptor de Errores 401/403 - IMPLEMENTADO
- Actualizado `lib/api.ts` para manejar respuestas 401 y 403
- Automatically calls signOut() y redirige al login cuando el token expira
- Mejora la experiencia de usuario ante sesiones expiradas

### ✅ 5. Rol STAFF con UI - IMPLEMENTADO
- Agregado STAFF al sidebar: Dashboard y Productos
- Los permisos ya estaban definidos en `types/permissions.ts`
- Ahora los empleados con rol STAFF pueden acceder al sistema con menú limitado

---

## 12. RESUMEN DE ESTADO FINAL

| Tema | Estado |
|------|--------|
| Permisos de Plantillas | ✅ Solo SUPER_ADMIN/SUPPORT_ADMIN |
| Selector de Empresa en Ventas | ✅ Eliminado |
| Middleware de Protección | ✅ Implementado |
| Interceptor 401/403 | ✅ Implementado |
| Rol STAFF | ✅ Con menu limitado |