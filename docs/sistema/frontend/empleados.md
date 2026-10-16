# Área: Empleados

Documenta el área de empleados del frontend Next.js (App Router). Código en
`frontend/app/(dashboard)/employees/` y `frontend/components/employees/`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/employees` | `frontend/app/(dashboard)/employees/page.tsx` | server | Lista empleados (`GET /employees`), muestra total, activos y directorio con rol/estado. |
| `/employees/new` | `frontend/app/(dashboard)/employees/new/page.tsx` | server | Verifica sesión, redirige a `/sign-in` si no hay usuario y renderiza `EmployeeForm` sin empleado (creación). |
| `/employees/[id]` | `frontend/app/(dashboard)/employees/[id]/page.tsx` | server | Detalle de empleado: hero con nombre/rol/estado y tarjeta de datos (email, teléfono, DNI, fechas). `notFound()` si no existe. |
| `/employees/[id]/edit` | `frontend/app/(dashboard)/employees/[id]/edit/page.tsx` | server | Carga el empleado y renderiza `EmployeeForm` con `employee` (edición). Llama `notFound()` si no existe. |

## Componentes

- `frontend/components/employees/employee-form.tsx` — formulario cliente de creación/edición. Valida con `createEmployeeSchema` (`frontend/lib/validations/employee.validation.ts`), incluye selector de rol y panel de permisos por rol (`ROLE_PERMISSIONS`, `PERMISSION_LABELS`, `PERMISSION_CATEGORIES` de `frontend/types/permissions.ts`). Hace `POST /employees` o `PATCH /employees/:id`.
- `frontend/components/employees/employee-actions.tsx` — exporta `EmployeeActions` (enlaces a edición con `PermissionGuard permission="employee:update"` y `DeleteDialog entity="employee"` con `employee:delete`) y `NewEmployeeButton` (enlace a `/employees/new` con `PermissionGuard permission="employee:create"`).
- `frontend/components/employees/employee-modal.tsx` — componente cliente con `Dialog` para crear/editar empleado mediante validaciones de `frontend/lib/validations`. Hace `POST/PATCH /employees`.

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `/employees` (página) | `GET /employees` | `serverApiFetch` | Server component; usa `accessToken` de `getServerSession`. |
| `/employees/[id]` (página) | `GET /employees/:id` | `serverApiFetch` | Detalle del empleado. |
| `/employees/[id]/edit` (página) | `GET /employees/:id` | `serverApiFetch` | Precarga del formulario. |
| `EmployeeForm` | `POST /employees` / `PATCH /employees/:id` | `apiFetch` | Método según `isEdit`. En creación envía `password` y `confirmPassword`; el body final descarta `confirmPassword` (`const { confirmPassword, ...body }`). |
| `EmployeeActions` (DeleteDialog) | `DELETE /employees/:id` | `apiFetch` | `frontend/components/common/delete-dialog.tsx`; invalida `['employees']`. |
| `EmployeeModal` | `POST /employees` / `PATCH /employees/:id` | `apiFetch` | En edición envía `isActive`; en creación envía `password`. |
| Toda página protegida | `GET /auth/me` | `getServerSession` (`frontend/lib/session.ts`) | Lee la cookie `access_token`; null si no hay sesión. |

## Estado global

- `useAuthStore` (`frontend/stores/auth.store.ts`) — `user`; usado por `PermissionGuard`/`usePermissions` y en `EmployeeForm`/`EmployeeModal`.
- `useUiStore` (`frontend/store/ui-store.ts`) — `addToast` para notificaciones.
- TanStack Query — `invalidateQueries({ queryKey: ['employees'] })` tras crear/editar/eliminar. Hook `useEmployees` en `frontend/hooks/useData.ts` usa la misma clave `['employees']`.
- `PermissionGuard` (`frontend/components/auth/permission-guard.tsx`) y `ROLE_PERMISSIONS` de `frontend/types/permissions.ts` — control de visibilidad de acciones y cálculo del panel de permisos por rol.

## Flujo de usuario

1. El usuario abre `/employees`; la página obtiene los empleados en el servidor y muestra métricas y directorio.
2. Pulsa `+ Nuevo empleado` (`NewEmployeeButton`) y va a `/employees/new`.
3. En `EmployeeForm` completa datos personales, DNI, contacto, contraseña (solo creación), rol y estado; al enviar valida y hace `POST /employees`.
4. Al éxito invalida `['employees']`, muestra toast y navega a `/employees`.
5. Desde el directorio entra a edición (`/employees/[id]/edit`); `EmployeeForm` precarga el empleado y hace `PATCH /employees/:id`.
6. El panel de permisos del formulario muestra los permisos asociados al rol seleccionado (`ROLE_PERMISSIONS`).
7. Desde las acciones puede eliminar mediante `DeleteDialog` (`DELETE /employees/:id`), si tiene permiso.

## Notas

- `EmployeeModal` existe en `frontend/components/employees/`, pero no se encontró importado en las páginas listadas de `employees/` (no verificado en el código su uso efectivo dentro de esta área).
- En `employee-form.tsx` el control visual de estado (`isActive`) no está enlazado a un handler que actualice su estado: el valor enviado proviene de checkbox ocultos con `defaultChecked` derivado de `employee?.isActive`. El comportamiento al alternar visualmente no se pudo verificar en el código.
- `employee-form.tsx` importa `useAuthStore` y asigna `user`, pero `user` no se usa en el cuerpo del componente.
- `serverApiFetch` devuelve `null` ante error o ausencia de token; las páginas usan valores por defecto (`?? 0`, `?? []`).
