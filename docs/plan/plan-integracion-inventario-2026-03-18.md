# Plan de Integracion Inventario

Fecha: 2026-03-18
Hora de elaboracion: 18:30 (aprox.)

## Objetivo 

Implementar un modulo de inventario con reglas de negocio claras:

- Moneda unica del sistema: Soles (PEN).
- Descuento e IGV (18%) consistentes en ventas.
- El stock solo aumenta por ingresos del mismo producto.
- El stock solo disminuye por ventas.

## Analisis funcional

1. Inventario controla la disponibilidad real para vender sin sobregiro de stock.
2. Permite trazabilidad de cada ingreso mediante movimientos con motivo, cantidad y costo.
3. Reduce errores operativos (ventas sin stock, costos desactualizados, registros duplicados).
4. Aporta base para reportes financieros y de reposicion.

## Plan de trabajo (hora-fecha)

### Fase 1 - Backend de negocio
- 2026-03-18 18:30-19:30
- Ajustar ventas para descuento global + IGV 18% por defecto.
- Asegurar que la creacion repetida de producto incremente stock y registre movimiento de entrada.

### Fase 2 - CRUD Inventario
- 2026-03-18 19:30-20:30
- Crear endpoints de entradas de inventario: listar, detalle, crear, actualizar, eliminar.
- Mantener consistencia de stock al editar/eliminar entradas.

### Fase 3 - Frontend modulo inventario
- 2026-03-18 20:30-21:30
- Construir UI en App Router con paginas dedicadas:
  - /inventory
  - /inventory/new
  - /inventory/[id]/edit
- Conectar servicios al backend y refrescar cache al operar CRUD.

### Fase 4 - Validacion y cierre
- 2026-03-18 21:30-22:00
- Validar reglas de stock con escenarios reales.
- Ejecutar lint frontend/backend y documentar resultados.

## Resultado esperado

Modulo de inventario operativo, coherente con ventas y con trazabilidad completa de ingresos de stock, respetando las reglas del negocio y la arquitectura del proyecto.
