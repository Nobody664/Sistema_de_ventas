# Módulo de Plantillas de Boletas/Facturas - Estado Final

## Decisiones de Diseño

### Acceso
- **Solo SUPER_ADMIN** puede acceder al módulo de gestión de plantillas
- COMPANY_ADMIN y otros roles no tienen acceso a crear/editar plantillas
- Cualquier usuario puede imprimir usando las plantillas (vía `/invoices/generate/:saleId`)

### Datos de Empresa
- **Eliminado** el concepto de companyId/empresa del formulario
- Las plantillas ya no guardan datos de empresa específicos
- Al imprimir, los datos se toman directamente de la empresa real del usuario
- Esto permite que las plantillas sean modelos genéricos

---

## Cambios Realizados

### Backend (`invoices.controller.ts`)
- `findTemplates`: solo SUPER_ADMIN
- `createTemplate`: solo SUPER_ADMIN
- `updateTemplate`: solo SUPER_ADMIN
- `removeTemplate`: solo SUPER_ADMIN
- `getDefaultTemplate`: COMPANY_ADMIN, MANAGER, CASHIER (para imprimir)
- `generateInvoice`: COMPANY_ADMIN, MANAGER, CASHIER (para imprimir)

### Frontend

**Sidebar** (`app-sidebar.tsx`):
- Acceso exclusivo para SUPER_ADMIN

**Páginas**:
- `/invoices/templates`: solo SUPER_ADMIN
- `/invoices/templates/new`: solo SUPER_ADMIN
- `/invoices/templates/[id]`: solo SUPER_ADMIN

**Formulario** (`template-editor.tsx`):
- Removido selector de empresa
- Removidos campos: companyRuc, companyAddress, companyPhone
- Los valores por defecto ahora son null
- La previsualización usa valores genéricos

---

## Impresión de Documentos

Cuando un usuario imprime una boleta/ticket/factura:
1. Llama a `/invoices/generate/:saleId`
2. El sistema usa la plantilla (global o por defecto)
3. Los datos de empresa se toman de `sale.company` directamente
4. No depende de los datos guardados en la plantilla
