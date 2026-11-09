# Fase 5: apariencia y colaboración

## Activación y migración

Migración aditiva `20261118000000_store_studio`: clave compuesta de membresía, funciones por compañía, apariencia versionada, medios, notas y vistas. Aplicar con `npx prisma migrate deploy` y generar el cliente antes de arrancar esta versión. Las funciones nuevas están desactivadas inicialmente; el dueño puede habilitarlas individualmente en Configuración → Funciones adicionales.

## Apariencia y medios

- `/comercio/apariencia`: edición de borrador, preview privado del borrador guardado, publicación explícita y restauración de la publicación anterior.
- Versiones optimistas de borrador/publicación y bloqueo de compañía para serializar publicación, archivo de medios y cambios de funciones. Un fallo de auditoría revierte también la publicación.
- JSON cerrado: tres presets, textos acotados, referencias de logo/portada y opciones de descripción/teléfono. Sin CSS, HTML ni URLs libres. El nombre comercial sigue en la configuración existente.
- Medios PNG/JPEG/WebP validados por contenido, recodificados a WebP y limitados a 1600 px (512 para logo) y 1 MB procesado. Hasta 50 medios por tienda.
- Implementación de almacenamiento interna: bytes normalizados en PostgreSQL, clave generada por servidor y endpoints controlados. No requiere credenciales de un bucket externo. Los comprobantes comerciales conservan su almacenamiento cifrado privado original.
- La URL pública solo sirve medios READY del publicado efectivo, de la misma compañía y propósito. Borradores y medios no publicados requieren sesión administrativa; no se habilitan con `?draft=1`.
- Se rechaza archivar medios referenciados por borrador, publicación actual o anterior. Limpieza horaria acotada de medios de más de 30 días sin referencias, con recorrido paginado para evitar bloquearse en imágenes en uso.
- La lectura pública usa la publicación válida, con fallback a la anterior o al aspecto original. Desactivar apariencia conserva sus datos y devuelve el aspecto original. Publicar no incrementa la versión comercial de cotizaciones.

## Colaboración

- Notas append-only en el detalle: texto plano, autor de membresía y fecha. FK compuestas impiden autores/pedidos de otra empresa. No se escriben en snapshots ni en el historial del comprador.
- Vistas personales para pedidos, catálogo y clientes: estado/diseño enumerados; sin búsquedas personales, cursores, SQL ni columnas libres. Máximo 20 por recurso/membresía, control de versión y un índice único parcial para la predeterminada.
- Auditoría transaccional sin duplicar textos privados ni imágenes. Publicaciones y notas producen avisos administrativos a través del outbox existente, emitidos después del commit. Las respuestas invalidan las consultas del editor.

## Evidencia

- Integración HTTP con Prisma y PostgreSQL embebido: separación borrador/publicado, versión obsoleta 409, medio ajeno/no preparado rechazado, archivo de medio en uso rechazado, restauración y rollback por fallo de auditoría.
- Notas inaccesibles al comprador y ausentes de su historial; FK cruzada rechazada. Vistas privadas entre dos dueños de la misma empresa, filtros prohibidos rechazados y una sola predeterminada.
- Chromium: activación individual, borrador sin efecto público, preview/publicación, creación de nota y guardado/aplicación/eliminación de vistas sin persistir la búsqueda personal.
- Builds y TypeScript de ambos proyectos, más pruebas de esquemas cerrados y eliminación de datos personales de vistas.

El piloto de un negocio real y la medición del despliegue se preparan en la fase 6; estas pruebas no representan cobros reales ni activación externa.
