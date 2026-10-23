# Plan y analisis - modulo de proveedores y ordenes automaticas

## Objetivo 

Implementar un modulo de proveedores para `COMPANY_ADMIN` que permita:

1. registrar y mantener proveedores,
2. vincular productos a proveedores,
3. detectar productos con stock bajo,
4. generar borradores de ordenes de compra automaticas agrupadas por proveedor.

## Contexto del sistema actual

- Backend: NestJS + Prisma + PostgreSQL con separacion por tenant (`companyId`) mediante guards.
- Frontend: Next.js App Router con rutas de dashboard y control por roles.
- Inventario y productos ya existen, por lo que el modulo de proveedores debe apoyarse en `Product.stockQuantity` y `Product.minStock`.

## Requisitos funcionales

1. CRUD basico de proveedores por empresa.
2. Asignacion de productos a proveedor con:
   - prioridad (`isPreferred`),
   - cantidad minima de compra (`minOrderQuantity`).
3. Preview de ordenes automaticas:
   - incluir solo productos activos con stock bajo,
   - elegir proveedor preferido por producto,
   - agrupar items por proveedor.
4. Generacion de ordenes en estado `DRAFT`.
5. Vista inicial para admins de empresa en dashboard.

## Modelo de datos propuesto (Prisma)

- `Supplier`
  - datos de identidad, contacto, marcas, tiempo de entrega e indicador activo.
- `SupplierProduct`
  - tabla pivote entre proveedor y producto por empresa.
- `SupplierOrder`
  - cabecera de orden de compra (estado, notas, si fue auto-generada, usuario creador).
- `SupplierOrderItem`
  - detalle por producto y cantidad sugerida/solicitada.
- `SupplierOrderStatus`
  - `DRAFT`, `SENT`, `CONFIRMED`, `CANCELLED`.

## Endpoints base

- `GET /suppliers`
- `POST /suppliers`
- `PATCH /suppliers/:id`
- `DELETE /suppliers/:id` (baja logica)
- `PUT /suppliers/:id/products`
- `GET /suppliers/auto-orders/preview`
- `POST /suppliers/auto-orders/generate`
- `GET /suppliers/orders`

Todos protegidos con `JwtAuthGuard + TenantGuard + RolesGuard`, rol `COMPANY_ADMIN`.

## Algoritmo de auto-generacion

1. Buscar productos activos de la empresa.
2. Filtrar `stockQuantity <= minStock`.
3. Buscar enlaces proveedor-producto activos y tomar el preferido.
4. Calcular faltante y cantidad sugerida:
   - `missingUnits = max(minStock - stockQuantity, 1)`
   - `suggestedQuantity = max(missingUnits, minOrderQuantity)`
5. Agrupar por proveedor.
6. Crear una orden `DRAFT` por proveedor con sus items.

## Fases de implementacion

### Fase 0 (completada)

- Esquema Prisma inicial para proveedores y ordenes.
- Servicio y controlador backend para CRUD basico + preview/generacion.

### Fase 1 (completada en esta iteracion)

- Integracion backend en `AppModule` y modulo Nest de proveedores.
- Vista inicial frontend `/suppliers` para `COMPANY_ADMIN`.
- Seccion en sidebar para acceso al modulo.

### Fase 2 (pendiente)

- Formularios de alta/edicion de proveedores.
- Pantalla de asignacion proveedor-producto con selector de prioridad.
- Filtros por marca, proveedor y estado de orden.

### Fase 3 (pendiente)

- Flujo operativo de ordenes:
  - cambio de estado `DRAFT -> SENT -> CONFIRMED/CANCELLED`,
  - carga de costo unitario real para actualizar referencias.
- Trazabilidad y auditoria de acciones.

### Fase 4 (pendiente)

- Sugerencias inteligentes por historial de consumo.
- Integracion con notificaciones internas y recordatorios de reabastecimiento.

## Riesgos y mitigacion

1. **Asignaciones incompletas proveedor-producto**
   - Mitigacion: advertencias en UI y reporte de productos sin proveedor preferido.
2. **Sobrecompra por minimos mal configurados**
   - Mitigacion: mostrar cantidades sugeridas antes de confirmar.
3. **Concurrencia en generacion masiva**
   - Mitigacion: transacciones atomicas y limites por lote.
4. **Calidad de datos de contacto**
   - Mitigacion: validaciones DTO y normalizacion de texto/email.

## Indicadores de exito

- Porcentaje de productos criticos con proveedor asignado.
- Tiempo promedio entre alerta de stock bajo y orden generada.
- Reduccion de quiebres de stock por empresa.
- Porcentaje de ordenes auto-generadas que se confirman sin ajustes.

## Checklist tecnico inmediato

- [ ] Ejecutar `npm run prisma:generate` en backend.
- [ ] Ejecutar migracion (`prisma migrate` o `db push` segun estrategia vigente).
- [ ] Validar `npm run lint` en backend y frontend.
- [ ] Agregar tests minimos del servicio de proveedores.
