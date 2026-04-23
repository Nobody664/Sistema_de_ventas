# Plan de Implementación - Sistema de Ventas

## Título: Mejoras y Correcciones del Sistema
**Fecha:** 15/03/2026
**Hora:** 

---

## 1. Mensajes de Límites de Planes

### Estado: ✅ IMPLEMENTADO

Los mensajes de error ahora incluyen:
- Recurso que llegó al límite
- Límite actual
- Sugerencia de mejorar plan

**Ejemplos implementados:**
- "Has alcanzado el límite de empleados de tu plan (X). Para continuar, considera mejorar tu plan."
- "Has alcanzado el límite de productos de tu plan (X). Para continuar, considera mejorar tu plan."

---

## 2. Notificaciones por Sesión/Tenant

### Estado: 🟡 POR REVISAR

**Problema identificado:**
Las notificaciones se están mostrando a todos los usuarios de la empresa, cuando deberían ser específicas por sesión/usuario.

**Análisis requerido:**
- Verificar que las notificaciones se filtren por `userId` o `companyId`
- Cada usuario debe ver solo sus notificaciones

---

## 3. Auto-generación de SKU y Código de Barras

### Estado: 🟡 POR IMPLEMENTAR

**Propuesta de implementación:**

El backend debe auto-generar:
- **SKU**: Formato `PRD-{CATEGORIA}-{SECUENCIAL}` 
  - Ejemplo: `PRD-BEB-001`, `PRD-ALI-002`
- **Código de barras**: Formato `7700XXXXXXXXXX` (13 dígitos)
  - Primeros 4 dígitos: código de empresa (7700)
  - siguientes 8 dígitos: identificador único
  - Último dígito: dígito verificador

**Ubicación del cambio:**
- `backend/src/modules/products/products.service.ts` - método `create()`

---

## 4. Validación de Documento de Identidad

### Estado: ✅ IMPLEMENTADO

- DNI: 8 dígitos
- RUC: 11 dígitos  
- Pasaporte: 6-20 caracteres

---

## Procedimiento de Aplicación

### Paso 1: SKU Auto-generado

```typescript
// En products.service.ts - create()
private generateSku(categoryCode?: string): string {
  const prefix = categoryCode ? `PRD-${categoryCode.toUpperCase().slice(0, 3)}` : 'PRD';
  const sequence = Date.now().toString(36).toUpperCase();
  return `${prefix}-${sequence.slice(-4)}`;
}

private generateBarcode(): string {
  // Formato: 7700 + 8 dígitos aleatorios + verificador
  const base = '7700' + Math.random().toString().slice(2, 10);
  const checkDigit = this.calculateEan13CheckDigit(base);
  return base + checkDigit;
}
```

### Paso 2: Validaciones Frontend

Ya implementadas en `customer.validation.ts` y `employee.validation.ts`

### Paso 3: Notificaciones

Revisar que el query de notificaciones filtre por:
- `companyId` para notificaciones de empresa
- `userId` para notificaciones personales

---

## Pendiente por Implementar

1. Auto-generación de SKU en backend
2. Auto-generación de código de barras en backend
3. Revisión de notificaciones por sesión
