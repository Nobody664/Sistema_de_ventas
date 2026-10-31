# Configuración — Fase 4: integraciones y canales

Rama: `refix/configuracion-fase-4-integraciones`, encadenada a la Fase 3 (`1601e66`).

Decisiones confirmadas: API de solo lectura, español/inglés y resumen a las 08:00 de la zona del negocio. Implementación y comprobaciones locales; la activación de los transportes externos queda ligada a la configuración real del entorno.

## API Keys

- Administración propia en `GET/POST /integrations/api-keys` y `POST /integrations/api-keys/:id/revoke`, exclusiva del administrador activo del negocio.
- Claves de 256 bits aleatorios con identificador público; solo se guarda SHA-256. El valor se devuelve una vez al crear y no entra en la caché de consultas ni en auditorías. Se conserva únicamente en el estado efímero de la pantalla, que se limpia al cambiar identidad.
- Permisos independientes: `catalog.read`, `inventory.read`, `sales.read`. No se aceptan permisos de escritura. Expiran a los 90 días por defecto; el contrato admite entre 1 y 365 días. Máximo diez activas por empresa.
- Lecturas en `GET /integrations/v1/catalog`, `/inventory` y `/sales`, con cabecera `X-API-Key`. La sesión de navegador no sustituye esta autenticación. La excepción al guard JWT solo corresponde a estas rutas y siempre se ejecuta `ApiKeyGuard`.
- La autenticación verifica hash, vencimiento, revocación, membresía administradora, usuario activo, empresa activa/trial y coincidencia de empresa. Cada petición consume la cuota mensual compartida del plan mediante el servicio atómico existente.
- Proyecciones explícitas, hasta 100 registros por respuesta, `nextCursor` y `?after=...`; decimales como cadenas. No se aceptan sobreescrituras de empresa en query. Las respuestas son privadas y `no-store`.
- Listados administrativos limitados a 100 registros, priorizando claves no revocadas con vencimiento más lejano y webhooks activos para que sus controles sigan accesibles.

## Webhooks salientes

- Administración en `GET/POST /integrations/webhooks`, desactivación en `POST /integrations/webhooks/:id/disable` y últimas 50 entregas en `GET /integrations/webhooks/:id/deliveries`. Máximo cinco activos por negocio, sujetos a `webhooks.manage`.
- Evento inicial `sale.created`, versión `1`, con identificador durable, empresa, fecha de creación y datos mínimos de venta: ID, número, estado, canal, total decimal y moneda. No incorpora contactos ni credenciales.
- El efecto `SALE_COMMITTED` existente encola las entregas después de la transacción de venta. La unicidad endpoint/evento evita volver a encolarlas durante un reintento. Un webhook nuevo no recibe ventas anteriores a su registro.
- Secreto aleatorio, visible una vez y cifrado con AES-256-GCM en PostgreSQL. La clave de cifrado de servidor es independiente de JWT y se conserva estable entre despliegues. Cambiarla requiere una estrategia de recifrado de los registros existentes.
- Cabeceras `X-Ventas-Event`, `X-Ventas-Delivery`, `X-Ventas-Timestamp` y `X-Ventas-Signature`. Firma: `v1=HMAC-SHA256(secreto, timestamp + "." + cuerpo JSON exacto)`; el receptor verifica además una tolerancia temporal de cinco minutos y deduplica por ID de entrega.
- Destinos HTTPS, puerto 443, sin credenciales ni fragmento, con hostname exacto en `WEBHOOK_ALLOWED_HOSTS`. Se resuelve DNS IPv4, se rechazan direcciones no públicas y se fija la dirección validada en la conexión manteniendo TLS del hostname. No se siguen redirecciones ni se guardan cuerpos de respuesta externos.
- Procesamiento durable con leases y compare-and-set: hasta diez intentos, espera creciente de uno a sesenta minutos y estado final detenido. El historial expone intentos, estado HTTP y fechas. No promete entrega exactamente una vez.

## Resumen diario

- Preferencias propias en `GET/PATCH /notification-channels/preferences`: `dailyDigestEnabled` y `locale`. El resumen comienza desactivado; no permite habilitarlo con `SMTP_ENABLED=false`.
- Un barrido cada cinco minutos selecciona el día anterior de la empresa desde las 08:00 locales, con recuperación durante ese mismo día si el proceso inició después. Respeta zonas IANA y cambios de horario.
- Snapshot de ventas completadas y total exacto, en español o inglés, con unicidad membresía/día. Guarda el idioma del mensaje para que asunto y contenido sigan siendo coherentes aunque cambie la preferencia antes de un reintento.
- El snapshot y `DAILY_DIGEST` se guardan juntos en transacción. Outbox reutiliza leases/reintentos existentes. Antes de enviar se comprueban nuevamente opt-in, membresía, rol, usuario y empresa. Solo marca `sentAt` tras confirmar el envío SMTP, usando un Message-ID estable. SMTP es un efecto externo con posible repetición tras un fallo entre envío y confirmación en BD.

## Web Push

- Estado en `GET /notification-channels/push`, registro en `POST /notification-channels/push` y eliminación propia en `POST /notification-channels/push/:id/remove`.
- Consentimiento mediante acción explícita del usuario y permiso del navegador. Hasta diez navegadores por membresía administradora. Solo acepta endpoints de FCM, Mozilla y Apple configurados en la validación; no permite URLs arbitrarias.
- Usa `web-push` para cifrado y VAPID. Endpoint y claves de la suscripción se almacenan cifrados; la proyección administrativa contiene solo identificador, hash de endpoint y fecha.
- Procesa notificaciones nuevas de empresa con menos de 24 horas, posteriores al registro del navegador, con deduplicación y hasta cinco intentos. Omite leídas, cuentas inactivas y entregas de una identidad anterior si el navegador se registra con otra cuenta. El registro renovado actualiza su fecha de corte para no reproducir historial.
- Los avisos de sistema operativo son genéricos: no contienen nombres, ventas, importes ni mensajes privados del negocio. El detalle se abre en la sesión autenticada. Suscripciones 404/410 se eliminan.
- `frontend/public/notifications-sw.js` muestra avisos y abre únicamente `/notifications` del mismo origen. No cachea páginas ni intercepta peticiones. CSP incorpora solo `worker-src 'self'` y conserva nonces/`strict-dynamic`.
- La recepción con pestaña cerrada depende del soporte y las políticas del navegador/sistema operativo; no equivale a garantizar entrega con el navegador completamente terminado.

## Español e inglés

- Diccionario real y contexto compartido SSR/cliente; cookie `ventas_locale` restringida a `es`/`en`. Cambiar idioma de administrador también guarda el idioma de sus resúmenes y Web Push en su membresía.
- Cobertura de esta fase: `/settings`, `/settings/company`, sus formularios, apariencia, región, alertas, integración API, webhooks, canales, exportación y acciones de suscripción. El progreso de exportación también se localiza.
- Los valores ingresados por personas, identificadores técnicos y mensajes arbitrarios devueltos por servicios conservan su contenido. Esta cobertura de Configuración no constituye una localización global de las pantallas de ventas, informes, soporte y administración de plataforma.

## Entorno y migraciones

Variables documentadas en `backend/.env.example`:

- `INTEGRATION_ENCRYPTION_KEY`: 32 bytes aleatorios codificados en base64, conservados entre despliegues.
- `WEBHOOK_ALLOWED_HOSTS`: hostnames exactos separados por coma; sin comodines ni URLs.
- `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: contacto y par VAPID generado para este entorno.
- Configuración SMTP existente: `SMTP_ENABLED`, host, puerto, usuario, contraseña y remitente.

Migraciones nuevas: `20261106000000_company_api_keys`, `20261107000000_outgoing_webhooks`, `20261108000000_notification_channels`. El historial se comprobó en PostgreSQL embebido. No se aplicaron a BD compartida ni se modificaron variables de Render/Vercel.

## Verificación

- Lint y builds backend/frontend aprobados; Prisma generado y esquema validado.
- Suite backend completa: 373 casos aprobados. Tras ajustes finales se verificaron otra vez las rutas/API, webhooks, outbox, migraciones y canales; la suite de canales se amplió de cinco a nueve casos, incluidos planificación única, entrega Web Push, suscripción expirada y transferencia entre cuentas. El conjunto actual contiene 377 casos.
- Frontend: 58 pruebas aprobadas.
- Chromium: 11 escenarios de Configuración, 16 de regresión general y 5 de productos/compras, todos aprobados. Incluyen secreto efímero, revocación, historial, error/reversión del opt-in, persistencia e idioma SSR/cliente, incluida edición de empresa en inglés.
- Los escenarios de UI utilizan backend sintético y los transportes externos se sustituyen en pruebas. La entrega real a SMTP, un receptor HTTPS o un servicio Web Push requiere la configuración y verificación de ese entorno cuando se autorice su activación.
