# Plan breve: notificaciones de stock y vigencias

Base: `main` en `095cb99`. Trabajo en subramas encadenadas, con commits en español por etapa.

| Etapa | Subrama | Entregable | Estado |
| --- | --- | --- | --- |
| 1 | `mejora/notificaciones-fase-1-enlaces` | Abrir el producto exacto desde alertas de stock y vencimiento, incluidas las históricas | Implementada y verificada |
| 2 | `mejora/notificaciones-fase-2-vigencias` | Política de vida útil, revisión periódica y avisos durables de próximos vencimientos y vencidos | Implementada y verificada |
| 3 | `mejora/notificaciones-fase-3-interfaz` | Configuración en producto, visibilidad de vigencias/lotes y pruebas funcionales | Pendiente |

## Diagnóstico inicial

- `LowStockService` incluye `data.productId`, pero no establece `actionUrl`; la interfaz termina en `/products`.
- Los vencimientos se revisan solo a las 07:00, con un plazo fijo de tres días, usando la hora del servidor y excluyendo fechas vencidas.
- La revisión no cubre la vigencia de cada lote. La fecha general del producto puede ser reemplazada al registrar entradas.
- La deduplicación actual depende de avisos sin leer: leerlos puede provocar nuevas alertas del mismo riesgo, y una alerta antigua sin leer puede ocultar cambios importantes.

## Decisiones de implementación

1. Enlaces a `/products/:id`; usar el ID ya guardado para alertas históricas y validar que los destinos sean internos.
2. Reloj de servidor con revisión al iniciar y cada cinco minutos, por lotes y sin ejecución local superpuesta. En Render gratuito la ejecución depende de que el servicio esté despierto; al reanudarse se recupera el estado actual. No se promete ejecución continua si la instancia está dormida o detenida.
3. Perfiles explícitos y editables: perecedero (3 días), estándar (30 días), larga duración (3 meses calendario), personalizado (1–3650 días). Los existentes tendrán un perfil estándar, sin adivinar su composición por el nombre. La interfaz ofrecerá orientación para conservas/atunes/enlatados, pero la clasificación y fecha de etiqueta se confirman al editar el producto.
4. Tomar la fecha de etiqueta como día calendario; comparar con el día actual de la zona de la empresa, sin confundir medianoche UTC con el día anterior. Tres meses se calculan por calendario y se ajustan a fines de mes.
5. Revisar cada lote con existencias y su propia fecha. Usar la fecha general para productos sin lotes con existencias. Omitir productos archivados/inactivos y existencias agotadas; avisar también si el producto o lote ya venció.
6. Separar revisión de envío: alertar al entrar o cambiar de etapa; recordatorios semanales durante el aviso temprano de larga duración y diarios desde 30 días antes, incluido el estado vencido. El cambio de urgencia genera un aviso propio.
7. Guardar una recepción durable por destinatario, producto/lote, fecha, etapa y período de recordatorio, junto con el evento outbox en una transacción. Leer o eliminar una notificación no debe causar spam, ni una alerta previa debe ocultar el paso a vencido. La unicidad en BD y outbox protege frente a varias instancias.
8. Respetar empresa, membresías activas y preferencias de stock/vencimiento. Revalidar las existencias y la vigencia al entregar para descartar avisos obsoletos.

## Verificación y cierre

- Pruebas de destino exacto, rutas seguras y alertas históricas.
- Pruebas de ventanas, tres meses calendario, fines de mes, zonas horarias, lotes, vencidos, deduplicación, concurrencia y recuperación de eventos.
- Validación de DTO, persistencia y campos en crear/editar/ver producto; pruebas de navegador del flujo de notificación a producto.
- Lint, pruebas y builds apropiados; historial SQL en PostgreSQL embebido. Migraciones escritas y cliente Prisma local; sin aplicar cambios a BD compartida.
- Commits locales por etapa y avance fast-forward de la siguiente subrama. Integración en `main`, push y despliegue quedan para una instrucción posterior.

### Resultado de etapa 1

Las nuevas alertas incluyen `actionUrl` al producto. La interfaz resuelve también el `data.productId` de avisos históricos que apuntaban al listado, conserva los destinos de otros tipos de notificación y rechaza escapes externos. Lint correcto en ambos proyectos, diez pruebas backend dirigidas y 61 pruebas frontend aprobadas.

### Resultado de etapa 2

- `Product.expiryProfile` (`PERISHABLE`, `STANDARD`, `LONG_LIFE`, `CUSTOM`) y `expiryWarningDays`, validados en crear/editar; `ProductExpiryAlert` y `PRODUCT_EXPIRED` nuevos.
- Revisión al iniciar y cada cinco minutos, sin solapamiento, para productos sin lotes y para cada lote con existencias. Usa la fecha de etiqueta como día calendario en la zona de la empresa, incluye vencidos y avisa tres meses calendario antes en larga duración.
- Recepciones durables por destinatario, producto/lote, fecha, etapa y período de recordatorio, con evento outbox en la misma transacción. Se revalidan empresa, membresía, preferencia, existencias y vigencia al entregar; la alerta pasa a vencido aunque exista un aviso previo sin leer.
- Entradas y edición de lotes disparan una comprobación inmediata; el ciclo periódico cubre el resto.
- Endpoint `GET /products/:id/expiry` para inspección de fuentes y etapas, con alcance por empresa.
- Verificación: lint y build backend, 389 pruebas backend (incluye historial SQL con la nueva migración), lint y 61 pruebas frontend. Migración escrita y cliente Prisma local; no aplicada a la base compartida.
