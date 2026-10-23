# Plan de fases: Cashier + POS + Caja + Yape

## Fase 1 (ejecutada)

Objetivo: habilitar operacion de ventas rapida para cajeros con control de caja y conciliacion manual de Yape.

Entregables implementados:
- Rol `CASHIER` habilitado para crear/editar clientes y crear/editar productos (sin eliminar).
- Modulo backend `cash` con:
  - Apertura de caja.
  - Ingresos manuales y egresos.
  - Cierre de caja con formula: esperado = apertura + ingresos - egresos.
  - Reporte diario por fecha.
  - Registro y conciliacion manual de Yape (`PENDING`, `CONFIRMED`, `REJECTED`).
  - Soft delete para transacciones Yape.
- Flujo de venta actualizado:
  - Metodo de pago `YAPE`.
  - Validacion de `cashSessionId` para ventas en efectivo.
  - Registro automatico de movimiento `SALE_CASH`.
  - Registro automatico de transaccion Yape en estado `PENDING`.
- Nuevas pantallas frontend:
  - `/(dashboard)/pos`: interfaz POS tactil (grid de productos + resumen/pago).
  - `/(dashboard)/cash`: operacion de caja + conciliacion Yape + vista de reporte diario.
- Navegacion lateral actualizada para mostrar `POS` y `Caja` segun roles de empresa.

## Fase 2 (ejecutada parcialmente)

Objetivo: fortalecer control operativo y auditoria de turnos.

Implementado en esta iteracion:
- Permisos avanzados por accion:
  - Reconciliacion Yape restringida a `COMPANY_ADMIN` y `MANAGER`.
  - Revision de arqueo restringida a `COMPANY_ADMIN` y `MANAGER`.
  - Operacion de caja diaria para `COMPANY_ADMIN`, `MANAGER`, `CASHIER`.
- Arqueo de caja:
  - Cierre con conteo por denominaciones (JSON de billetes/monedas).
  - Motivo obligatorio cuando existe diferencia vs. monto esperado.
  - Estado de revision (`NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED`).
  - Endpoint y UI de doble validacion (cajero cierra, supervisor revisa).

Pendiente de Fase 2:
- Sin pendientes criticos. Implementado:
  - Flujo de aprobacion para anulaciones/reembolsos (solicitud + revision).
  - Consolidado por metodo de pago en reporte diario.
  - Exportacion CSV/PDF del reporte diario de caja.

## Fase 3 (planificada)

Objetivo: evolucionar de conciliacion manual a pagos mas automatizados.

Alcance propuesto:
- Integracion con pasarelas (Stripe/Mercado Pago/otras).
- Webhooks y conciliacion semiautomatica.
- Estados de pago unificados para POS y suscripciones.
- Alertas de fraude/simple scoring por discrepancias.

## Fase 3 (arqueo operativo - ejecutada)

Implementado en esta iteracion:
- Arqueo avanzado con auditorias parciales y de supervisor (`CashCountAudit`).
- Flujo de revision de arqueos parciales por `MANAGER`/`COMPANY_ADMIN`.
- Historial completo de arqueos por sesion de caja.
- Reporte diario enriquecido:
  - ventas por metodo,
  - top vendedores,
  - ventas por hora.
- Validacion profesional de vendedor en cada venta:
  - toda venta se vincula al empleado activo del usuario autenticado,
  - rechazo si no existe perfil de empleado activo,
  - trazabilidad real de quien vendio cada operacion.

## Criterio de salida por fase

- Fase 1: flujo de venta operativo en 3 pasos, caja abierta/cerrada, conciliacion Yape manual y reporte diario.
- Fase 2: arqueo completo con trazabilidad y permisos finos por accion.
- Fase 3: pagos integrados con confirmacion asincrona y conciliacion automatizada.
