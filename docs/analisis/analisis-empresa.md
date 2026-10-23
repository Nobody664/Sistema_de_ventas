# Análisis: Error 403 al crear plantillas de documentos

## Problema
El sistema retorna error 403 con el mensaje "Debe especificar una empresa" cuando se intenta crear una plantilla de documento.

## Análisis del Sistema

### Backend - Flujo de autenticación y tenant

1. **JWT Strategy** (`backend/src/modules/auth/jwt.strategy.ts`):
   - Extrae `companyId` del payload del JWT
   - Valida que la empresa exista y obtiene su status
   - Retorna el objeto usuario con `companyId` y `companyStatus`

2. **Tenant Guard** (`backend/src/common/guards/tenant.guard.ts`):
   - Verifica que el usuario tenga `companyId` para usuarios no-SUPER_ADMIN
   - Asigna `request.tenantId = user.companyId`
   - Lanza excepción si no hay empresa

3. **Invoices Controller** (`backend/src/modules/invoices/invoices.controller.ts`):
   - `POST /templates` para COMPANY_ADMIN: llama `invoicesService.create(request.tenantId, false, body)`
   - Pasa `tenantId` al servicio

4. **Invoices Service** (`backend/src/modules/invoices/invoices.service.ts`):
   - Línea 48-49: `if (!isGlobal && !companyId) throw ForbiddenException('Debe especificar una empresa')`
   - El problema es que `companyId` está vacío

### Frontend

- Las llamadas API a `/invoices/templates` se hacen correctamente con el token JWT
- El sidebar mostraba el menú solo para SUPER_ADMIN y SUPPORT_ADMIN
- Las páginas de plantillas también restringían el acceso

## Causa Raíz

El error ocurre porque:
1. COMPANY_ADMIN y MANAGER no tenían acceso al menú de plantillas en el sidebar
2. Las páginas de plantillas solo permitían SUPER_ADMIN y SUPPORT_ADMIN
3. Aunque el backend permite el acceso mediante @Roles, el frontend restringía

## Solución Implementada

### 1. Actualizar sidebar
- Mover "Plantillas de Documentos" de superAdminItems a companyItems
- Ahora disponible para COMPANY_ADMIN y MANAGER

### 2. Actualizar permisos en páginas
- `templates/page.tsx`: Permitir acceso a COMPANY_ADMIN y MANAGER
- `templates/new/page.tsx`: Permitir acceso a COMPANY_ADMIN y MANAGER
- `templates/[id]/page.tsx`: Permitir acceso a COMPANY_ADMIN y MANAGER + pasar companies al TemplateEditor

### 3. Selector de empresa (ya implementado)
- El TemplateEditor ya tiene un selector para elegir empresa
- Los datos de la empresa se auto-completan en los campos correspondientes

### 4. Configuración de empresa (ya implementado)
- Nueva página `/settings/company` para que COMPANY_ADMIN configure los datos de su empresa
- Incluye: nombre, razón social, RUC, dirección, email, teléfono

## Estado

✅ Implementado
- Acceso de COMPANY_ADMIN/MANAGER a plantillas
- Selector de empresa en formulario
- Configuración de datos de empresa