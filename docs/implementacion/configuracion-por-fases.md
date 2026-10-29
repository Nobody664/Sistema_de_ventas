# Configuración funcional por fases

Base inicial: `main` en `bb2d7f3`. Las cuatro subramas se crearon localmente desde esa base.

| Fase | Subrama                                     | Alcance                                                                                         | Estado                               |
| ---- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1    | `refix/configuracion-fase-1-base`           | Tema, empresa, región, errores y actualización de preferencias usando infraestructura existente | Implementada y verificada localmente |
| 2    | `refix/configuracion-fase-2-notificaciones` | Preferencias operativas por usuario/empresa sobre notificaciones persistidas y SSE              | Preparada; implementación pendiente  |
| 3    | `refix/configuracion-fase-3-datos`          | Exportación de los datos propios del negocio con formato versionado                             | Preparada; implementación pendiente  |
| 4    | `refix/configuracion-fase-4-integraciones`  | API Keys, webhooks salientes, Web Push, resumen por correo y traducciones                       | Preparada; implementación pendiente  |

## Forma de integración

Las ramas 2, 3 y 4 son puntos de partida reservados, sin cambios de implementación. Antes de comenzar una fase deben actualizarse con la base consolidada de la fase anterior. No deben desarrollarse como copias independientes de una versión antigua.

Secuencia propuesta para cada fase:

1. Validar el trabajo en su subrama.
2. Guardar cada fase terminada en un commit local, sin push ni despliegue, según la decisión del usuario.
3. Actualizar la siguiente subrama desde la subrama anterior mediante fast-forward mientras todavía no tenga commits propios. `main` permanece sin cambios hasta que se autorice la integración.
4. Implementar y verificar la siguiente fase.

No se publican automáticamente los cambios de una fase por el solo hecho de crear su subrama.

## Fase 2 — Notificaciones

- Reutilizar la tabla de notificaciones, la entrega SSE, el sonido y los productores de ventas/stock existentes.
- Definir y persistir preferencias operativas por usuario y empresa; los avisos críticos de cuenta y pagos requieren una política explícita y separada.
- Exponer lectura/actualización de las preferencias del actor autenticado, sin aceptar otra empresa o usuario en el payload.
- Aplicar esas preferencias al producir o entregar las alertas, no solo a un interruptor visual.
- Las alertas dentro del sistema no deben presentarse como Web Push. La entrega con el navegador cerrado y el resumen por correo se reservan para la fase avanzada.
- Esta fase puede requerir una migración de preferencias; debe revisarse antes de aplicarse a una BD compartida.

## Fase 3 — Datos

- Reutilizar los filtros tenant y las utilidades de exportación existentes.
- Exportar únicamente los datos del negocio autenticado, con versión, fecha y colecciones identificadas, excluyendo credenciales y secretos.
- Prever procesamiento por lotes, descarga y estado visible para volúmenes grandes.
- Diferenciar exportación de negocio de backups físicos de PostgreSQL, administrados por plataforma/proveedor.

## Fase 4 — Integraciones avanzadas

- API Keys con permisos, revocación y autenticación propia.
- Webhooks salientes con eventos definidos, firma, reintentos e historial de entrega, separados de los webhooks entrantes de pagos.
- Web Push con service worker, consentimiento y suscripciones del navegador.
- Resumen diario con ejecución según zona del destinatario y canal SMTP operativo.
- Traducciones reales antes de ofrecer un selector de idioma.
- Cualquier cambio de moneda requiere una política financiera específica; no equivale a sustituir un símbolo en la interfaz.

Todas las fases deben conservar la separación entre `SUPER_ADMIN` de plataforma, sin negocio propio, y `COMPANY_ADMIN` con empresa y suscripción.
