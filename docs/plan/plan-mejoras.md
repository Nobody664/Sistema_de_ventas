# Plan de Mejoras - SISTEMA_DE_VENTAS

## 1. Servicios Externos e Integraciones

### 1.1 Búsqueda de Cliente por DNI (PERÚ)
**Prioridad: ALTA**

- [ ] Endpoint para consultar DNI en API externa (SUNAT/Reniec)
- [ ] Cachear resultados para evitar consultas repetitivas
- [ ] Frontend: Campo de búsqueda con autocompletado
- [ ] Mostrar datos: nombre, apellido, teléfono, dirección

```typescript 
// Backend - propuesta
GET /customers/search?dni=12345678
// Retorna: { dni, nombre, apellido, telefono?, direccion? }
```

### 1.2 Búsqueda de Empresa por RUC
**Prioridad: ALTA**

- [ ] Endpoint para consultar RUC en SUNAT
- [ ] Cachear resultados
- [ ] Auto-llenar datos de empresa al registrar

### 1.3 Envío de Boletas por Email
**Prioridad: MEDIA**

- [ ] Generar PDF de boleta/ticket
- [ ] Endpoint para enviar por email
- [ ] Cola de trabajos para批量envío

---

## 2. Validaciones y Seguridad

### 2.1 Validaciones de Datos
**Prioridad: ALTA**

- [ ] Validar formato de RUC (11 dígitos, checksum)
- [ ] Validar formato de DNI (8 dígitos)
- [ ] Validar email con formato correcto
- [ ] Validar teléfono peruano
- [ ] Validar código de producto único

### 2.2 Seguridad Avanzada
**Prioridad: MEDIA**

- [ ] Implementar HTTPS obligatorio
- [ ] Protección CSRF
- [ ] Sanitización de inputs
- [ ] Rate limiting por usuario
- [ ] Logs de seguridad

### 2.3 Auditoría
**Prioridad: MEDIA**

- [ ] Registrar todas las acciones de usuarios
- [ ] Historial de cambios en entidades importantes
- [ ] Exportar logs de auditoría

---

## 3. Métricas y Analytics

### 3.1 Métricas de Ventas
**Prioridad: ALTA**

- [ ] Ventas por hora/día/semana/mes
- [ ] Ticket promedio
- [ ] Productos más vendidos (top 10)
- [ ] Clientes frecuentes
- [ ] Métodos de pago utilizados

### 3.2 Métricas de Inventario
**Prioridad: ALTA**

- [ ] Valor total del inventario
- [ ] Productos sin movimiento (X días)
- [ ] Rotación de inventario
- [ ] Productos próximos a vencer

### 3.3 Métricas de Clientes
**Prioridad: MEDIA**

- [ ] Clientes nuevos por mes
- [ ] Clientes inactivos
- [ ] Mejor cliente (por monto)
- [ ] Segmentación (frecuentes, ocasionales, nuevos)

### 3.4 Métricas Financieras
**Prioridad: MEDIA**

- [ ] Ingresos por categoría
- [ ] Margen de ganancia
- [ ] Comparación con período anterior
- [ ] Proyección de ingresos

---

## 4. Vistas y Diseños

### 4.1 Dashboard Personalizable
**Prioridad: MEDIA**

- [ ] Widgets arrastrables
- [ ] Elegir métricas a mostrar
- [ ] Guardar preferencias por usuario

### 4.2 Gráficos Avanzados
**Prioridad: MEDIA**

- [ ] Gráfico de tendencia de ventas
- [ ] Gráfico de categorías más vendidas
- [ ] Gráfico de horarios pico
- [ ] Mapa de clientes por zona

### 4.3 Informes PDF/Excel
**Prioridad: MEDIA**

- [ ] Reporte de ventas diario/semanal/mensual
- [ ] Reporte de inventario
- [ ] Reporte de clientes
- [ ] Exportar a Excel

---

## 5. Funcionalidades de Ventas

### 5.1 Carrito de Compras
**Prioridad: ALTA**

- [ ] Múltiples items en una venta
- [ ] Descuentos por item/subtotal/total
- [ ] Aplicar impuestos (IGV)
- [ ] Notas por producto

### 5.2 Métodos de Pago
**Prioridad: ALTA**

- [ ] Efectivo
- [ ] Tarjeta (débito/crédito)
- [ ] Yape/Plin
- [ ] Transferencia
- [ ] Crédito (a cuenta)

### 5.3 Notas de Crédito/Débito
**Prioridad: BAJA**

- [ ] Crear notas de crédito por devolución
- [ ] notas de crédito por descuento

---

## 6. Gestión de Inventario

### 6.1 Movimientos de Stock
**Prioridad: ALTA**

- [ ] Registro de entradas (compra)
- [ ] Registro de salidas (venta)
- [ ] Ajustes de inventario
- [ ] Devoluciones

### 6.2 Alertas
**Prioridad: ALTA**

- [ ] Stock mínimo por producto
- [ ] Productos próximos a vencer
- [ ] Notificaciones push

---

## 7. CRM Avanzado

### 7.1 Cliente Profesional
**Prioridad: MEDIA**

- [ ] Datos de empresa (RUC, razón social)
- [ ] Contactos múltiples
- [ ] Historial de interacciones

### 7.2 Programa de Puntos
**Prioridad: BAJA**

- [ ] Acumular puntos por compra
- [ ] Canjear puntos por productos
- [ ] Niveles de cliente

---

## 8. Empleados y Permisos

### 8.1 Permisos Granulares
**Prioridad: MEDIA**

- [ ] Permisos por acción (crear, editar, eliminar, ver)
- [ ] Permisos por módulo

### 8.2 Registro de Actividad
**Prioridad: MEDIA**

- [ ] Quién hizo qué y cuándo
- [ ] Logs por empleado

---

## 9. Configuración de Empresa

### 9.1 Datos Fiscales
**Prioridad: ALTA**

- [ ] RUC, razón social, dirección fiscal
- [ ] Logo para impresiones
- [ ] Pie de página en boletas

### 9.2 Moneda e Idiomas
**Prioridad: BAJA**

- [ ] Múltiples monedas
- [ ] Multi-idioma

---

## 10. Mejoras de UX/UI

### 10.1 Experiencia de Usuario
**Prioridad: ALTA**

- [ ] Búsqueda global (Ctrl+K)
- [ ] Atajos de teclado
- [ ] Modo offline básico
- [ ] Optimización mobile

### 10.2 Optimización
**Prioridad: MEDIA**

- [ ] Carga lazy de componentes
- [ ] Optimizar bundle
- [ ] Cache de API

---

## Resumen de Prioridades

| Prioridad | Funcionalidades |
|-----------|-----------------|
| **ALTA** | DNI search, RUC search, validaciones, métricas ventas, inventario, POS, métodos pago |
| **MEDIA** | Email boletas, seguridad, auditoría, gráficos, reportes, CRM, permisos |
| **BAJA** | Notas crédito, programa puntos, multi-moneda, multi-idioma |

---

## Próximos Pasos Inmediatos

1. **DNI Search** - Buscar cliente por DNI
2. **Validaciones** - RUC, DNI, teléfono
3. **Métricas ventas** - Dashboard mejorado
4. **Inventario** - Alertas de stock bajo
5. **POS** - Carrito y múltiples métodos de pago

---

*Documento generado el 17 de Marzo 2026* 
