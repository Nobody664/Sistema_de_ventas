# Configuración — Fase 3: exportación del negocio

Rama: `refix/configuracion-fase-3-datos`, encadenada a la Fase 2 (`5053b11`).

## Contrato

- `GET /data-export/manifest` identifica formato `ventas.business-data`, versión `1`, fecha inicial, datos públicos de empresa, colecciones, codificación de decimales y exclusiones.
- `GET /data-export/:collection?startedAt=ISO&after=cursor` devuelve un lote, su colección y el siguiente cursor. El alcance se deriva siempre de la identidad autenticada; las filas hijas se filtran mediante su padre de la empresa.
- Solo el administrador de empresa con membresía activa puede descargar. Se conservan `JwtAuthGuard`, `RolesGuard`, `TenantGuard` y permisos de administración de empresa. Plataforma, cajeros y gerentes no pueden utilizar estos endpoints.
- Las 26 colecciones son categorías, productos, presentaciones, clientes, empleados, sucursales, ventas/detalles, proveedores/productos/órdenes/detalles, entradas/detalles/comprobantes, lotes, kardex, movimientos, distribuidores/saldos/entregas/stock, finanzas, notas de crédito/detalles y cupones.
- Cada colección usa una proyección cerrada validada contra el esquema Prisma. No se exportan usuarios de autenticación, contraseñas, tokens, secretos, claves de idempotencia, sesiones, facturación de suscripciones, conversaciones de soporte, auditorías ni datos globales.
- Se conservan importes y cantidades `Decimal` como cadenas, y fechas como ISO. Los campos `deletedAt` de los datos operativos permanecen para identificar registros archivados.

## Volumen y consistencia

- Lotes de hasta 500 filas y aproximadamente 1 MiB de contenido, con paginación por clave y sin depender de que la fila anterior siga existiendo. El stock de distribuidor utiliza su clave compuesta.
- La descarga se arma como partes de Blob en el navegador, con progreso por colección y registros, límite de 100 MiB y cancelación. No se ofrece un archivo parcial cuando falla una petición.
- La cancelación también opera durante la pausa por límite de solicitudes. Un HTTP 429 permite hasta dos pausas de un minuto antes de devolver el error.
- Cambiar de sesión o desmontar la pantalla cancela las peticiones. La identidad de empresa del manifiesto se valida antes de armar el archivo y se vuelve a comprobar la sesión antes de iniciar la descarga.
- El manifiesto vence a las 24 horas. La fecha inicial filtra la creación de registros; **no establece una instantánea transaccional**. Las modificaciones/eliminaciones concurrentes pueden reflejarse durante la lectura, tal como informa la interfaz. No es un backup físico ni un mecanismo de restauración.

## Verificación

- Lint y build backend y frontend correctos.
- Suite completa backend: **351 pruebas aprobadas**, ninguna fallida o cancelada. Incluye validación HTTP de permisos, query, suplantación de tenant y caché privada; proyecciones, cursores, fechas, decimales y membresías.
- Suite frontend: **57 pruebas aprobadas**, incluidas descarga multipágina, formato, aislamiento, cursores repetidos y cancelación durante rate limiting.
- Chromium: **7 escenarios de Configuración**, **16 de regresión general** y **5 de productos/compras** aprobados. Se descarga y se lee el JSON real producido por la interfaz con un backend sintético.
- Se actualizó la prueba de historial SQL para aplicar también migraciones posteriores a la de plantillas. Verifica en PostgreSQL embebido que la migración de preferencias inicializa las membresías y que las preferencias de una empresa no alteran las de otra.
- En ejecuciones concurrentes hubo un timeout de navegación del menú y una aparición intermitente de React #418 en Configuración; ambas suites pasaron al repetirlas de forma independiente. No se eliminaron sus comprobaciones de errores del navegador.

Esta fase no añade migraciones propias. La migración de la Fase 2 solo se ejecutó en el PostgreSQL embebido de pruebas; no se aplicó a BD compartida. Los commits son locales.
