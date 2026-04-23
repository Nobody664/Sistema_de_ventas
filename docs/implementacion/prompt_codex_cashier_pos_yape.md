# Sistema POS Multiempresa con Cashier, Caja y Control de Yape

## 1. Rol: Cashier (Cajero / Vendedor)
- Creado por Admin_Company
- Permisos limitados orientados a ventas y caja

### Permisos:
- Clientes: crear, leer, editar
- Productos: crear, leer, editar limitado, no eliminar
- Ventas: crear, leer, imprimir
- Caja: abrir, operar, cerrar
- Reportes: diario
- Configuración: no acceso

---

## 2. UI/UX POS (Pantalla táctil)
### Resoluciones soportadas:
- 1024x768
- 1366x768
- 1920x1080

### Layout:
- Izquierda: productos (grid táctil)
- Derecha: resumen de venta + pago

### Reglas UX:
- Botones grandes (mín 48px)
- Alto contraste
- Flujo rápido (máx 3 pasos para vender)

---

## 3. Flujo de Venta
1. Seleccionar cliente
2. Agregar productos
3. Calcular total
4. Seleccionar método de pago
5. Confirmar venta

---

## 4. Lógica de Caja

### Apertura:
- Monto inicial

### Ingresos:
- Ventas efectivo
- Ingresos manuales

### Egresos:
- Gastos

### Fórmula:
Esperado = apertura + ingresos - egresos

---

## 5. Yape (Cuentas digitales)

### Problema:
No hay API pública simple para validación automática.

### Solución:
Sistema de conciliación manual asistida.

### Estados:
- PENDING
- CONFIRMED
- REJECTED

### Registro:
- monto
- nombre
- referencia
- hora
- evidencia

---

## 6. Arquitectura Backend (NestJS)
- auth module (JWT + roles)
- users module
- sales module
- cash module
- payments module
- reports module

### DB:
- PostgreSQL

---

## 7. Arquitectura Frontend (Next.js + TS)
- auth context
- pos module
- cash module
- reports module

---

## 8. Seguridad
- RBAC
- Auditoría completa
- Soft delete

---

## 9. Fases
### Fase 1:
- POS básico
- Caja
- Yape manual

### Fase 2:
- permisos avanzados
- arqueo

### Fase 3:
- integración pasarelas

---

## FIN
