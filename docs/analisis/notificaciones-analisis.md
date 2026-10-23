# Análisis y Plan: Sistema de Notificaciones

## 1. Análisis del Sistema Actual

### Estructura de Notificaciones

#### Backend

| Archivo | Descripción |
|---------|-------------|
| `notifications.service.ts` | Lógica de negocio - crea, lee, marca como leídas |
| `notifications.controller.ts` | Endpoints REST + SSE para notificaciones en tiempo real |
| `schema.prisma` | Modelo `Notification` con `userId` obligatorio |

#### Frontend

| Archivo | Descripción |
|---------|-------------|
| `notifications-client.tsx` | Componente principal de lista de notificaciones |
| `notification-bell.tsx` | Componente de campanita con contador |
| `notifications-store.ts` | Estado global de notificaciones |

### Cómo Funciona Actualmente

1. **Creación de notificaciones**: Se crean con `userId` específico para cada evento
2. **Recuperación**: El endpoint `/notifications` usa `findByUser(user.id)` para filtrar por usuario
3. **Tiempo real**: SSE con Map de clients por userId

### Problemas Identificados

#### Problema 1: Discrepancia de campos en CurrentUser

El decorador `CurrentUser` retorna un objeto con `sub` como ID de usuario:
```typescript
// current-user.decorator.ts
export type AuthUser = {
  sub: string;  // <-- El ID del usuario está en 'sub'
  email: string;
  companyId?: string | null;
  roles: string[];
};
```

Pero en `notifications.controller.ts` se usa `user.id`:
```typescript
findAll(@CurrentUser() user: { id: string; companyId?: string }) {
  return this.notificationsService.findByUser(user.id, {...});
}
```

Esto significa que `user.id` es `undefined` porque el campo real es `sub`.

#### Problema 2: Tipos inconsistentes en el Controller

El controller tiene:
```typescript
findAll(@CurrentUser() user: { id: string; companyId?: string })
```

Pero debería coincidir con el tipo `AuthUser`:
```typescript
findAll(@CurrentUser() user: { sub: string; companyId?: string })
```

#### Problema 3: No hay diferenciación entre SUPER_ADMIN y usuarios de empresa

Las notificaciones para SUPER_ADMIN vs COMPANY_ADMIN podrían mezclarse si:
- Un SUPER_ADMIN también tiene membership en empresas
- El campo `companyId` no se usa correctamente para filtrar

## 2. Plan de Solución

### Cambios Requeridos

#### 2.1 Corregir tipos en notifications.controller.ts

Cambiar la firma del método para usar `sub` en lugar de `id`:

```typescript
// ANTES
findAll(@CurrentUser() user: { id: string; companyId?: string })

// DESPUÉS  
findAll(@CurrentUser() user: AuthUser)
```

#### 2.2 Actualizar métodos del servicio para el caso SUPER_ADMIN

Para SUPER_ADMIN, las notificaciones de solicitudes de upgrade deben verse diferente:
- No filtrar solo por `userId`
- Mostrar notificaciones globales relacionadas con su rol

#### 2.3 Mejorar la creación de notificaciones

Cuando se crea una notificación para un usuario:
- Verificar que el `userId` sea correcto
- Para SUPER_ADMIN: crear notificaciones sin `companyId` o con `companyId: null`
- Para COMPANY_ADMIN: incluir `companyId` correcto

### Flujo de Notificaciones para Plan Upgrade

```
1. COMPANY_ADMIN solicita upgrade
   → Crear notificación para SUPER_ADMIN (varias)
   → Tipo: PLAN_UPGRADE_REQUEST
   → userId: ID del super_admin

2. SUPER_ADMIN aprueba/rechaza
   → Crear notificación para COMPANY_ADMIN
   → Tipo: SUBSCRIPTION_APPROVED / SUBSCRIPTION_REJECTED  
   → userId: ID del company_admin
   → companyId: ID de la empresa
```

## 3. Implementación

### Paso 1: Corregir types del controller

Archivos a modificar:
- `backend/src/modules/notifications/notifications.controller.ts`

### Paso 2: Verificar la creación de notificaciones en plan-upgrade-requests

Ya está correcto en el código actual:
- Líneas 170-179: Notifica a SUPER_ADMIN cuando se envía comprobante
- Líneas 332-339: Notifica a COMPANY_ADMIN cuando se aprueba

### Paso 3: Probar el flujo completo

1. Crear solicitud de upgrade como COMPANY_ADMIN
2. Verificar que SUPER_ADMIN vea la notificación
3. Aprobar como SUPER_ADMIN
4. Verificar que COMPANY_ADMIN vea la notificación de aprobación

## 4. Resultado Esperado

- Las notificaciones se filtran correctamente por usuario
- SUPER_ADMIN ve las solicitudes de upgrade pendientes
- COMPANY_ADMIN recibe notificación cuando se aprueba su solicitud
- No hay mezcla de notificaciones entre usuarios
