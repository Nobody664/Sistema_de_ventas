# Fase 6: adopción y validación

## Controles entregados

- Flag administrativo independiente por compañía en `store_admin_features.experience_enabled`, con versión propia. No reutiliza `StorefrontSettings.enabled`, no altera el checkout y no borra datos.
- `STORE_ADMIN_ROLLOUT=all|pilot|off`: `all` conserva el comportamiento previo de esta rama; `pilot` requiere coincidencia exacta con un ID en `STORE_ADMIN_PILOT_COMPANIES` (lista separada por comas); `off` y valores desconocidos usan el panel anterior.
- El dueño puede desactivar su experiencia o reactivarla si el despliegue lo permite, mediante `GET/PATCH /store-admin/experience`. La identidad y la compañía provienen de la sesión; se validan membresía y versión bajo bloqueo y se registra auditoría.
- `/tienda-administracion` conserva el panel anterior para comparación y reversión. Los enlaces a un pedido preservan su ID en `?pedido=`. Compañías restringidas solo reciben atención histórica, sin catálogo, configuración ni integración.
- La vuelta al centro usa contexto del servidor mientras se revalida la caché del cliente, para evitar que una entrada antigua provoque un bucle de redirecciones.
- `STORE_ADMIN_TELEMETRY=true` habilita mediciones optativas: método, plantilla de ruta, estado HTTP, duración y compañía. Incluye 403/409/5xx y respuestas abortadas; no registra query, cabeceras, cuerpo, referencias de pago ni documentos.
- El filtro de errores omite consultas, mensajes libres y stacks en logs de administración, conservando el contrato HTTP de respuesta.
- Los formularios principales envían eventos acotados de apertura, guardado y abandono con cambios locales. Solo incluyen tipo de formulario, evento y duración. Son métricas best-effort, no auditoría financiera ni garantía de entrega al cerrar el navegador. Se desactivan junto con la telemetría y no crean conexiones SSE.

## Migraciones

Aplicar `npx prisma migrate deploy` y generar Prisma antes de iniciar esta versión:

1. `20261118000000_store_studio`: fase 5.
2. `20261119000000_store_adoption`: flag y versión de experiencia.
3. `20261120000000_store_inbox_index`: único índice adicional de bandeja medido.

En tablas grandes, el operador puede preparar el mismo índice con `CREATE INDEX CONCURRENTLY` fuera de una transacción, verificar que sea válido y luego ejecutar la migración, que usa `IF NOT EXISTS`. Conservar las tablas y los datos al revertir la interfaz.

## Medición reproducible de consultas

Comando: `cd backend` y `npm run bench:store-admin`. Trabaja exclusivamente en una base PostgreSQL/PGlite en memoria; no conecta a la base del negocio.

Dataset: 100 000 pedidos sintéticos, 10 compañías, 1 000 cuentas y primera página de 31 filas. Se conserva el índice actual por compañía/cuenta/fecha para contrastar el candidato por compañía/fecha descendente/ID descendente. Cada escenario ejecuta una primera consulta y cinco repeticiones calientes, con `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.

| Medición local | Resultado observado |
| --- | --- |
| Inicialización de PostgreSQL embebido | 14 662,612 ms |
| Construcción y ANALYZE del índice candidato | 1 448,674 ms |
| Primera ejecución sin índice de bandeja | 99,826 ms |
| Mediana caliente sin índice de bandeja | 57,659 ms |
| Primera ejecución con índice de bandeja | 14,868 ms |
| Mediana caliente con índice de bandeja | 0,516 ms |
| Plan sin índice | Bitmap scan de 10 000 filas y top-N sort |
| Plan con índice | Index scan de 31 filas; sin sort |

Esto justifica `store_orders(company_id, created_at DESC, id DESC)` para la bandeja general. No justifica crear todos los índices candidatos ni predice tiempos de red, arranque en frío de Render, filtros por cliente o cargas reales. La inicialización del motor y las consultas calientes se informan por separado; no se presentan como SLO de producción.

## Matriz de validación local

- Suites completas aprobadas: backend 487 pruebas, frontend 115 pruebas; TypeScript, builds y cadena completa de migraciones también aprobados. La ejecución completa del backend finalizó con 0 fallos, cancelaciones y pruebas omitidas.
- HTTP real con Prisma/PostgreSQL embebido: permisos de dueño/comprador/plataforma, compañías cruzadas, membresías revocadas, empresa restringida, pago tardío, reembolso, snapshots y cursores.
- Apariencia: versiones obsoletas, medio ajeno/no preparado, publicación fallida, restauración y fallback desde una publicación corrupta.
- Vistas: datos personales/SQL rechazados, aislamiento por membresía, una sola predeterminada y límite de 20 por recurso.
- Adopción: empresa excluida del piloto no puede activarse; reversión no modifica versión comercial ni checkout; versión obsoleta 409; reactivación autorizada.
- Telemetría: un 403 se mide sin query/credenciales; errores no escriben notas o valores privados; eventos con campos adicionales son rechazados.
- Chromium con fixtures: recorridos de las fases 1–5, nueva conexión única y reconexión controlada, retorno al panel anterior, restauración, enlace profundo conservado, atrás/adelante, Escape en visor privado, texto al 200 %, contraste del titular en tres presets y anchos hasta 320/390/768/1024/1440.

La simulación de EventSource del navegador comprueba el estado cliente; las pruebas de notificaciones/outbox del backend comprueban su transporte y persistencia. Ninguna prueba utiliza un cobro real.

## Piloto real: ejecución pendiente de despliegue

No se activó ni se modificó una compañía externa desde esta sesión. Para desplegar el piloto:

1. Elegir una compañía autorizada y configurar `STORE_ADMIN_ROLLOUT=pilot`, su ID exacto en `STORE_ADMIN_PILOT_COMPANIES` y, si se desea medir, `STORE_ADMIN_TELEMETRY=true`.
2. Aplicar migraciones, iniciar API/frontend y comprobar contexto, elegibilidad y flag de esa compañía. No alterar la habilitación de la tienda pública para controlar la experiencia administrativa.
3. Contrastar pedidos, importes y métodos con `/tienda-administracion`. Usar pasarela de pruebas o fixtures para ensayar pagos; separar estas comprobaciones de un cobro real.
4. Medir en el despliegue arranque frío y operación caliente por separado, latencias p50/p95, 403/409/5xx, retraso de avisos y formularios con cambios abandonados. Contrastar también EXPLAIN y cardinalidades del negocio real.
5. Revisar teclado, lector de pantalla y contraste completo en el entorno del usuario. Las comprobaciones automatizadas locales no sustituyen una revisión asistida con lector de pantalla.
6. Ampliar la lista piloto o usar `all` cuando la evidencia del negocio lo permita. El flag local permite revertir una compañía; `off` devuelve todas al panel anterior.

Reversión: cambiar el flag o el modo de despliegue. Conservar migraciones, pedidos, reservas, publicaciones, notas y vistas. El cambio de interfaz no revierte ni repite comandos comerciales.
