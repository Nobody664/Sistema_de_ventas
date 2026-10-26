# Dashboard operativo y navegación de negocio

## Jerarquía del dashboard

La portada del negocio se centra en el trabajo del día:

- Importe de ventas completadas, cantidad de ventas y ticket promedio calculado para ese mismo día.
- Alertas de inventario con una acción de revisión. El contador de productos agotados se presenta como parte de los productos bajo el mínimo, evitando interpretarlos como dos conjuntos que deban sumarse.
- Accesos a historial, clientes e inventario según permisos y módulos del plan.
- Acceso a Reportes para análisis por período, gráficos y resultados detallados.

Se retiraron de la portada los paneles repetidos de métricas, rankings y distribución de pagos. El resumen usa `/dashboard/tenant` y transmite al cliente únicamente los campos que necesita; ya no monta un segundo panel que consulta `/dashboard/metrics`.

Las cifras mantienen el alcance empresa/vendedor devuelto por el servidor. Un cajero ve “Solo tus ventas” y no recibe acciones administrativas de inventario. Si el inventario está limitado a una muestra, la pantalla indica su cobertura. La ausencia de métricas muestra un estado de consulta pendiente en vez de ceros inventados.

## Barra lateral

- Se retiró el acceso lateral “Notificaciones”. La campana del encabezado conserva el acceso a las notificaciones.
- “Operaciones” agrupa Cupones, Distribuidores, Proveedores, Órdenes de compra y Notas de crédito, conservando los filtros existentes por rol y plan.
- En escritorio se abre un menú a la derecha mediante Radix, con navegación por teclado, cierre con Escape y restauración del foco.
- En móvil se expande dentro del panel lateral para evitar desbordamientos. Navegar a una ruta cierra el panel y el grupo identifica las rutas activas.

La navegación de plataforma permanece separada de la navegación del negocio.

## Verificación

- `npm run lint`: correcto.
- `npm test`: 47 pruebas aprobadas.
- `node node_modules/next/dist/bin/next build --webpack`: correcto.
- `npm run test:browser:refix`: 16 comprobaciones aprobadas con datos sintéticos, incluyendo los nuevos casos de dashboard, menú lateral y alcance de cajero.
- Revisión visual de capturas a 1440 px y 390 px, en claro y oscuro; sin desbordamiento horizontal en móvil.

Las capturas se pueden generar definiendo `REFIX_SCREENSHOT_DIR` al ejecutar la prueba de navegador. Los cambios de esta entrega corresponden a la interfaz y a la selección de datos SSR; no requieren migraciones de base de datos.
