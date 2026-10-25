# Refix backend — Fase 5

Rama: `refix/backend-fase-5`, creada desde la Fase 4 (`316b3df`).

Alcance: B-17, B-18, B-19 y B-20 del informe técnico backend del 23 de octubre de 2026.

## B-17 — Integridad de reportes y finanzas

### Reportes y dashboard

- Los reportes contabilizan ventas `COMPLETED`. Totales, productos y distribución por canal comparten tenant, audiencia de vendedor, estado, canal y rango.
- La serie de los últimos siete días del rango usa agregaciones en BD con los mismos filtros, en lugar de cargar una muestra de 1000 ventas. Los días fuera del rango solicitado no incorporan ventas externas al filtro.
- El ranking de productos se limita a ocho grupos desde la consulta.
- El rango predeterminado de reportes es de 30 días; las fechas sin hora y los buckets diarios del reporte se interpretan en UTC. La comparación mensual conserva su significado de mes actual frente al anterior y respeta audiencia, estado y canal.
- El dashboard de empresa obtiene por agregación los conteos e importes completos de hoy y del período. Los desgloses que conservan muestras incluyen `dataCoverage`: hasta 500 ventas, hasta 10000 productos y ranking sobre las últimas 25 ventas completadas. Se informan límites, tamaño y truncamiento donde corresponda.
- El dashboard de métricas admite entre 1 y 366 días. Rechaza períodos con más de 10000 ventas actuales o anteriores, en vez de devolver un resumen parcial como exhaustivo.
- El dashboard global agrupa pagos por moneda. `collectedRevenue` corresponde explícitamente a PEN y `collectedRevenueByCurrency` conserva las otras monedas. La recurrencia se estima con precios actuales del catálogo, ponderados por ciclo y número de suscripciones; no representa un histórico de precios contratados.
- Las estadísticas de pagos declaran moneda PEN y calculan recaudación mensual por `paidAt`.
- Las claves de caché modificadas usan la versión `v3`.

### Finanzas de empresa

- El listado utiliza un `UNION ALL` parametrizado de registros manuales y ventas completadas. PostgreSQL ejecuta filtros, orden y paginación sobre el conjunto combinado.
- La página y el conteo usan el mismo filtro dentro de una transacción `RepeatableRead`. No existe el antiguo recorte de 500 filas por fuente.
- El orden usa fecha de registro, fecha de creación, fuente e identificador como desempates estables.
- Los resúmenes se agrupan en BD por dirección, categoría y semana; reciben el mismo filtro de búsqueda, fechas, categoría y dirección.
- El resumen trabaja con una moneda explícita (`currency`, PEN por defecto). Las filas manuales conservan su moneda. Las ventas mantienen la convención histórica PEN porque el modelo actual no almacena una moneda por venta; no se realiza conversión monetaria.
- Se conserva la convención funcional existente de entradas/compras y salidas/ventas.
- Las compras de cliente tienen páginas y totales separados: las estadísticas agregan todas sus ventas completadas dentro de la audiencia autorizada, independientemente de la página visible.

## B-18 — CSV seguro para hojas de cálculo

El escape CSV y la neutralización de fórmulas se aplican como operaciones distintas:

- Se prefija con apóstrofo el texto que puede iniciar una fórmula (`=`, `+`, `-`, `@`), incluso después de espacios o controles relevantes.
- También se neutralizan controles al inicio de una celda.
- Después se escapan comillas, comas y saltos de línea conforme a CSV.
- Los números reales siguen siendo números: por ejemplo, `-10` numérico se conserva; el texto `"-10"` se protege como texto. También se protegen encabezados.

Las pruebas inspeccionan el archivo generado. No ejecutan fórmulas ni aplicaciones de escritorio.

## B-19 — Consultas acotadas y cuota concurrente

### Contratos y paginación

- `PaginationQueryDto` transforma y valida `page` y `limit`. Los servicios afectados vuelven a comprobar los límites: página 1–1000000, tamaño 1–100.
- Pagos, historial, pendientes administrativos y empresas de plataforma usan consultas concretas. El cuerpo de creación de checkout tiene un DTO de clase con código de plan acotado, por lo que participa en validación y whitelist.
- `GET /api/payments` admite `page` y `limit`, conserva el cuerpo de tipo array y devuelve una página. El endpoint `/api/payments/history` añade el total y los metadatos de paginación.
- Las compras de cliente devuelven `page`, `limit` y `total` junto al listado y las estadísticas completas.
- Los rangos compartidos rechazan fechas imposibles o invertidas y, cuando ambos extremos están resueltos, intervalos superiores a 366 días. Reportes y resumen financiero resuelven por defecto una ventana de 30 días.
- Los registros de consumo API tienen tamaños de página y fechas validados también en el servicio.
- El resumen de consumo API pagina empresas de manera estable y agrupa registros en BD. Devuelve `page`, `limit`, `total` y `totalsScope: PAGE`: sus totales corresponden a las empresas de esa página. Los proveedores se separan por moneda. El catálogo se limita a 100 e informa si está truncado.

### Mensajes y exportaciones

- Los mensajes de chat se consultan por cursor `before` y `limit` (50 por defecto, máximo 100), después de comprobar acceso a la conversación.
- El cursor pertenece a la misma conversación y usa fecha más identificador para resolver empates. Cada página se devuelve en orden cronológico, empezando por la página más reciente.
- Los endpoints de soporte de empresa y plataforma conservan un array como cuerpo e indican `X-Has-More` y `X-Next-Cursor`, expuestos mediante CORS. Para pedir mensajes anteriores se envía `before=<X-Next-Cursor>`.
- Las exportaciones de productos, clientes, inventario y ventas leen lotes de 500 con cursor estable. El archivo síncrono admite hasta 10000 filas; excederlas produce un error explícito en lugar de entregar un archivo truncado. Este límite también acota la construcción en memoria de CSV, XLSX y PDF.
- Las estadísticas de exportación de clientes excluyen ventas canceladas y devueltas.

### Cuota API

- La cuota usa la fila compartida de empresa/período, una transacción serializable y un incremento condicionado a no superar el límite. Los consumos deben ser enteros positivos.
- El guard comprueba acceso al módulo, sin consumir antes de validar el documento ni consultar la caché.
- **Unidad de consumo:** un intento externo. Un documento inválido o una respuesta desde caché no consume. Una consulta externa consume antes de ejecutarse y no se reembolsa si el proveedor devuelve error o agota el tiempo.
- La fecha del período es UTC. Las consultas administrativas sin tenant conservan su excepción de plataforma; una consulta con empresa consume la cuota de esa empresa.
- Los timeouts externos usan `AbortSignal.timeout`, sin temporizadores manuales pendientes tras fallos de red.
- La cuota de BD es compartida entre réplicas. El throttling HTTP configurado en Nest continúa siendo local a cada réplica; no se presenta como un contador distribuido.

## B-20 — Readiness y ciclo de vida SSE

- `GET /api/health/ready` responde 503 cuando PostgreSQL no está disponible. Liveness no depende de la BD.
- Redis se considera una dependencia degradable para caché/pubsub: su fallo produce `degraded` con HTTP 200 si la BD está disponible. Las comprobaciones de BD y Redis se ejecutan en paralelo y tienen deadline de dos segundos. El deadline acota la espera HTTP, no cancela la operación interna del driver.
- SSE revalida usuario activo, versión de credencial, familia de sesión, membresía y roles. Comprueba la expiración del token inicial.
- Hay heartbeat y revalidación cada 15 segundos, con un deadline de dos segundos para consultar identidad. Una revocación se detecta en la siguiente comprobación, no de manera instantánea.
- La conexión dura como máximo cinco minutos o hasta la expiración del token, lo que ocurra primero. Cada usuario puede mantener hasta tres conexiones **por réplica**.
- Cierre, error, cliente lento y apagado liberan suscripciones y temporizadores. Una escritura que activa backpressure cierra el stream para evitar acumular datos sin límite.
- La integración del frontend incorpora reconexión con backoff de 1–30 segundos. Antes de abrir de nuevo consulta el contador mediante `apiFetch`, que puede renovar la sesión. Un 401/403 final detiene la reconexión. La desconexión explícita invalida reintentos pendientes, incluido un intento que ya esperaba una respuesta.

## Verificación y entrega

Backend:

```text
npm run lint
npm run build
npm run format
node -r ts-node/register -r tsconfig-paths/register --test --test-concurrency=2 "src/**/*.spec.ts"
```

Resultado: **296 pruebas aprobadas en 86 suites, 0 fallos**; 26 pruebas adicionales respecto a Fase 4. También se aprobó `git diff --check`.

Frontend: lint y build de producción aprobados; formato aplicado al archivo de integración SSE.

Las regresiones incluyen contratos HTTP reales para pagos y readiness, generación CSV, construcción de SQL parametrizado, paginación financiera posterior al antiguo límite, filtros de reportes, cobertura de métricas, cuota concurrente con repositorio simulado, caché/fallo externo y ciclo de vida SSE con reloj simulado.

No se ejecutó este SQL financiero ni la concurrencia de cuota contra PostgreSQL de integración. No se realizó una prueba de navegador de la reconexión. Las pruebas unitarias y HTTP descritas no sustituyen esas comprobaciones de despliegue.

Esta fase no modifica el esquema Prisma ni añade migraciones. No se aplicaron migraciones a la BD compartida ni se hizo push. El siguiente bloque corresponde a B-21–B-24.
