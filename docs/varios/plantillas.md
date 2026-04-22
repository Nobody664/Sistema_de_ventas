# Módulo de Plantillas de Documentos

## Resumen de Implementaciones

### Funcionalidades Implementadas

#### 1. Lista de Plantillas (`/invoices/templates`)
- **Agrupación por tipo**: Las plantillas se muestran organizadas por tipo (BOLETA, TICKET, FACTURA) con secciones diferenciadas visualmente.
- **Cards por tipo**: Cada tipo tiene su propia tarjeta con icono, color y contador de plantillas.
- **Acciones**: 
  - Ver detalles de plantilla
  - Editar plantilla
  - Eliminar plantilla (con confirmación)

#### 2. Editor de Plantillas (`/invoices/templates/new` y `/invoices/templates/[id]`)
- **Tabs de configuración**: 
  - Configuración: Formulario completo de opciones
  - Vista Previa: Preview en tiempo real del documento
- **Selector de empresa**: Dropdown para seleccionar empresa registrada y auto-completar datos (RUC, dirección, teléfono)
- **Opciones de configuración**:
  - Tipo de documento (BOLETA, TICKET, FACTURA)
  - Nombre y descripción
  - Tamaño de papel (A4, A5, Thermal)
  - Fuente y tamaño
  - Datos de empresa (RUC, teléfono, dirección, logo)
  - IGV (porcentaje)
  - Campos a mostrar (logo, empresa, cliente, vendedor, productos, etc.)
  - Plantilla por defecto

#### 3. Vista Previa en Tiempo Real
- **Preview térmico**: Renderizado especial para tickets de 58mm
- **Preview estándar**: Renderizado para A4/A5 con tabla de productos, subtotal, IGV, total
- **Sincronización**: Los cambios en el formulario se reflejan inmediatamente en el preview

#### 4. Configuración de Empresa (`/settings/company`)
- Nuevo formulario para que COMPANY_ADMIN configure los datos de su empresa:
  - Nombre de la empresa
  - Razón Social
  - RUC
  - Dirección
  - Email
  - Teléfono

### Problemas Solucionados

1. **Error de build**: Los imports de `template-editor` estaban con ruta relativa incorrecta (`./template-editor` en lugar de `../template-editor`)

2. **Error de hidratación**: Faltaba `<tbody>` en la tabla de totales del preview estándar

### Archivos Modificados/Creados

#### Frontend
- `frontend/app/(dashboard)/invoices/templates/page.tsx` - Página principal
- `frontend/app/(dashboard)/invoices/templates/invoices-templates-client.tsx` - Componente de lista
- `frontend/app/(dashboard)/invoices/templates/template-editor.tsx` - Editor con preview
- `frontend/app/(dashboard)/invoices/templates/new/page.tsx` - Nueva plantilla
- `frontend/app/(dashboard)/invoices/templates/[id]/page.tsx` - Editar plantilla
- `frontend/app/(dashboard)/settings/company/page.tsx` - Configuración de empresa
- `frontend/types/api.ts` - Tipos actualizados (Company con taxId, address, etc.)

#### Backend
- `backend/src/modules/companies/dto/company.dto.ts` - DTOs actualizados (legalName, taxId, address)
- `backend/src/modules/companies/companies.service.ts` - Servicio actualizado

### Flujo de Uso

1. El **SUPER_ADMIN** crea empresas desde el panel de admin
2. El **COMPANY_ADMIN** configura los datos de su empresa en `/settings/company`
3. Al crear una plantilla de documento, selecciona su empresa del dropdown y los campos se auto-completan
4. Los documentos generados usan los datos de la empresa configurada