# Análisis y Plan: Sistema de Tickets y Boletas

## 1. Análisis del Sistema Actual

### Estructura Actual

| Componente | Estado | Descripción |
|------------|--------|-------------|
| `InvoiceTemplate` (Prisma) | ⚠️ Básico | Solo campos genéricos, falta tipo de documento |
| `invoices.service.ts` | ⚠️ Básico | HTML muy simple, no coincide con referencias |
| `invoices-templates-client.tsx` | ⚠️ Básico | Formulario simple sin opciones de diseño |
| `sale-detail-client.tsx` | ✅ Funcionando | Genera invoice al imprimir |

### Comparación con Referencias Visuales

| Elemento | Imagen Referencia | Sistema Actual |
|----------|------------------|----------------|
| Logo | ✅ Presente | ❌ No configurable |
| Tipo documento | "BOLETA DE VENTA" / "TICKET" | ❌ No hay opción |
| Empresa: RUC | ✅ 10472251271 | ❌ Falta campo en schema |
| Empresa: Dirección | ✅ Completa | ❌ Falta campo |
| Empresa: Teléfono | ✅ Completo | ❌ Falta campo |
| Cliente: DNI | ✅ 75421968 | ❌ Solo documentValue |
| Cliente: Correo | ✅ presente | ❌ No se muestra |
| Fecha/Hora | ✅ Separados | ⚠️ Solo fecha |
| Items | ✅ Con formato | ⚠️ Básico |
| Serie/Número | ✅ B001-00001 | ⚠️ Solo saleNumber |
| IGV | ✅ 18% | ⚠️ hardcodeado |
| Método pago | ✅ Efectivo | ⚠️ Solo texto básico |
| Footer | ✅ "Gracias por su preferencia" | ⚠️ No configurable |

### Lo que Faltan Completamente

1. **API de Consulta DNI** - No existe endpoint para consultar RENIEC
2. **Tipos de documento** - No hay diferenciación entre BOLETA, TICKET, FACTURA
3. **Plantillas profesionales** - No hay plantillas prediseñadas
4. **Datos de empresa** - Schema no tiene RUC, dirección, teléfono

---

## 2. Plan de Solución

### Fase 1: Extender Schema de InvoiceTemplate

Agregar campos necesarios:
- `type`: BOLETA | TICKET | FACTURA
- `companyRuc`: RUC de la empresa
- `companyAddress`: Dirección
- `companyPhone`: Teléfono
- `showSaleNumber`: Mostrar número de venta
- `showSaleDate`: Mostrar fecha
- `showSaleTime`: Mostrar hora
- `showPaymentMethod`: Mostrar método de pago
- `footerText`: Texto personalizable
- `taxPercentage`: Porcentaje de IGV configurable
- `showLogo`: Ya existe

### Fase 2: Crear API de Consulta DNI (RENIEC)

Endpoint: `GET /dni/:dni`
- Consultar API externa de RENIEC (Perú)
- Retornar: nombres, apellidoPaterno, apellidoMaterno, direccion, sexo, fechaNacimiento

### Fase 3: Mejorar Generador de HTML

Crear plantillas profesionales:
- **Boleta Standard**: Formato A4, todos los datos
- **Ticket**: Formato reducido (58mm), ideal para impresión térmica
- **Factura**: Con datos de RUC, incluir campo de dirección fiscal

### Fase 4: Actualizar Frontend de Plantillas

- Selector de tipo de documento
- Vista previa en vivo
- Campos adicionales para configuración
- Plantillas predefinidas

---

## 3. Implementación

### Paso 1: Actualizar Schema (Prisma)
### Paso 2: Crear endpoint DNI
### Paso 3: Mejorar generateInvoiceHtml
### Paso 4: Actualizar frontend

---

## 4. Resultado Esperado

- Plantillas profesionales que coinciden con las referencias
- API funcional para consultar DNI
- Diferentes tipos de documentos (Boleta, Ticket, Factura)
- Datos completos de empresa visibles
- Información completa del cliente
