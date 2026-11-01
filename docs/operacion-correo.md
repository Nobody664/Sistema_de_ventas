# Operación y diagnóstico de correo SMTP / Resend

## Correcciones realizadas

- El backend ahora selecciona explícitamente SMTP o Resend por HTTPS. Antes ignoraba `EMAIL_PROVIDER=resend` y `RESEND_API_KEY` y siempre intentaba SMTP.
- `EMAIL_ENABLED` habilita el correo; si no existe, se conserva la compatibilidad con `SMTP_ENABLED`.
- Los correos de tienda, recuperación, resúmenes y outbox usan el mismo transporte y criterio de habilitación.
- Se usa el nombre del remitente; ya no se inventa una dirección de envío cuando falta configuración.
- Resend usa endpoint HTTPS fijo, timeout, verificación de aceptación e idempotencia derivada del Message-ID. No se hace fallback automático SMTP tras un resultado incierto, para evitar duplicados.
- SMTP reconoce TLS implícito en 465/2465 y STARTTLS en 587/2587, con TLS mínimo 1.2.
- Un destinatario o plantilla inválidos producen error, no un falso envío confirmado.
- Se reparó el package-lock con npm 10.9.4: el deploy fallaba por el peer de webpack ausente en la resolución de npm 10, aunque npm 11 permitía instalar localmente. `npm ci --dry-run --include=dev` con npm 10.9.4 ya pasa.

## Resultado de la revisión del 1 de noviembre de 2026

1. Render utiliza una instancia Free. Ese plan bloquea salidas a puertos SMTP 25, 465 y 587. Los logs mostraban `EmailService: Connection timeout`.
2. La aplicación estaba configurada con Gmail en 587 y, simultáneamente, `EMAIL_PROVIDER=resend`. La segunda variable no tenía efecto en la versión anterior.
3. El último deploy había fallado durante `npm ci`; seguía activa la versión previa.
4. El remitente anterior pertenecía a un subdominio `vercel.app`, distinto del dominio comercial.
5. Se configuró en Render `EMAIL_PROVIDER=resend`, `EMAIL_ENABLED=true`, `EMAIL_FROM_EMAIL=notificaciones@qorium-investment.qpon` y `EMAIL_FROM_NAME=Sistema de ventas`, sin reemplazar otras variables ni exponer claves.
6. El dominio comercial tiene TXT DKIM en `resend._domainkey`, SPF en `send` y MX de retorno en `send` publicados. La disponibilidad de DNS no equivale por sí sola a que Resend haya terminado su verificación.
7. La clave responde como restringida a la consulta de dominios. Al intentar el envío, Resend devuelve HTTP 400: el dominio asociado a la API key no está verificado. No se aceptó ni se entregó el mensaje de prueba en esos intentos.
8. Después de que el propietario reemplazó `RESEND_API_KEY` en Render, la prueba al correo autorizado fue **aceptada por Resend** desde `notificaciones@qorium-investment.qpon`, con ID `01a19931-b5f8-7b71-8e51-f3b958471aae`. La clave de solo envío no permite consultar el evento posterior de entrega, por lo que Inbox/Spam o el dashboard de Resend deben confirmarlo. La prueba se ejecutó con el transporte nuevo localmente y las variables de Render en memoria; no equivale por sí sola a una prueba ejecutada dentro de la instancia remota.
9. El destinatario confirmó la recepción en **spam**. Queda validado el envío y la recepción; la ubicación en Inbox requiere mejorar autenticación/reputación, no cambiar nuevamente las credenciales que ya funcionan.
10. La corrección `af6ee57` alcanzó estado **live** en Render. `/api/health/ready` respondió OK y los logs registraron `Email aceptado por resend: daily-summary` desde la instancia desplegada. No se observaron errores en el intervalo posterior revisado.

## Configuración recomendada en Render

Configurar estas variables en el **backend**, no en variables públicas de Next.js:

```dotenv
EMAIL_ENABLED=true
EMAIL_PROVIDER=resend
RESEND_API_KEY=<clave_de_envio_del_dominio_verificado>
EMAIL_FROM_EMAIL=notificaciones@qorium-investment.qpon
EMAIL_FROM_NAME=Sistema de ventas
```

`SMTP_ENABLED` puede mantenerse por compatibilidad; `EMAIL_ENABLED` tiene prioridad. Los valores SMTP no se usan cuando el proveedor seleccionado es Resend.

El endpoint de Resend es fijo (`https://api.resend.com`); `RESEND_API_BASE_URL` no permite redirigir credenciales a otra URL.

### Dominio y clave

1. En Resend → Domains, abrir `qorium-investment.qpon` y comprobar que figura **Verified**, con los registros de la región mostrada por Resend.
2. En API Keys, crear una clave con permiso de envío y dominio `qorium-investment.qpon` verificado. Una clave vinculada a otro dominio pendiente no sirve aunque el remitente sea correcto.
3. Guardar esa clave directamente en `RESEND_API_KEY` de Render. No publicarla en el repositorio, navegador ni conversaciones.
4. Guardar cambios y esperar al deploy. Si todavía aparece `KEY_DOMAIN_UNVERIFIED`, comprobar que la clave y el dominio pertenecen a la misma cuenta de Resend.

La alternativa de prueba `onboarding@resend.dev` solo sirve para destinos permitidos por Resend (normalmente el correo del propietario). No sustituye un dominio verificado para registrar y notificar clientes reales.

No se encontró DMARC en la consulta inicial. Es recomendable configurarlo según la política del dominio; su ausencia no fue el motivo del HTTP 400 de la API key. Evitar crear registros SPF duplicados y usar los valores exactos que indique Resend.

### Si Gmail entrega en spam

1. Marcar el mensaje recibido como **No es spam**; agregar el remitente a contactos si corresponde.
2. En Gmail → menú del mensaje → **Mostrar original**, comprobar los resultados SPF y DKIM y su dominio. La existencia de registros DNS no demuestra por sí sola el resultado de autenticación de un mensaje concreto.
3. Publicar un TXT DMARC inicial en el proveedor DNS de `qorium-investment.qpon`, si todavía no existe:

| Campo | Valor |
| --- | --- |
| Tipo | TXT |
| Nombre/Host | `_dmarc` (o `_dmarc.qorium-investment.qpon` si el panel pide el nombre completo) |
| Valor | `v=DMARC1; p=none; adkim=r; aspf=r` |
| TTL | 3600, o el valor predeterminado del proveedor |

4. Esperar la propagación y revisar la autenticación en futuros mensajes. No duplicar un registro DMARC existente. Esta política inicial no rechaza correo; endurecerla requiere verificar todos los emisores legítimos del dominio.
5. Mantener un remitente estable y evitar pruebas a cuentas inventadas/demos que puedan rebotar. Revisar rebotes/quejas en Resend.

DMARC ayuda a autenticar el dominio, pero no garantiza Inbox: Gmail también usa reputación, antigüedad, interacción y contenido. Las notificaciones transaccionales no deben mezclarse con envíos masivos sin consentimiento.

## Diagnóstico desde la aplicación desplegada

Endpoints protegidos exclusivamente para SUPER_ADMIN con permisos de configuración de plataforma:

- `GET /api/platform/email`: estado, proveedor, dominio y problemas de configuración; no devuelve contraseñas/API keys.
- `POST /api/platform/email/verify`: conexión SMTP sin envío o consulta de Resend. Una clave restringida puede impedir listar dominios; se informa esa limitación sin afirmar que el remitente está verificado.
- `POST /api/platform/email/test`: envío real con destinatario validado y límite de tres solicitudes por hora. Cuerpo:

```json
{
  "to": "tu-correo@ejemplo.com",
  "testId": "ef0f837c-40d0-457d-bc26-a127bab73d01"
}
```

Usar un UUID nuevo para una prueba distinta. Si se reintenta la misma prueba tras un fallo de red, conservar el UUID para reutilizar su clave de idempotencia. No cambiar remitente/destinatario/contenido reutilizando un UUID previamente aceptado.

Desde la consola del navegador, estando conectado como SUPER_ADMIN en el frontend:

```js
await fetch('/api/platform/email').then(r => r.json());
await fetch('/api/platform/email/verify', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
}).then(r => r.json());
```

Para comprobar la entrega real, ejecutar la prueba al correo autorizado y verificar el mensaje en Resend → Emails y en la bandeja/spam. `accepted: true` significa que el proveedor lo aceptó, no garantiza Inbox; el evento `delivered` de Resend confirma aceptación por el servidor destinatario.

## Diagnóstico local con la misma implementación

```powershell
npm run build
node scripts/diagnose-email.cjs
node scripts/diagnose-email.cjs --send-to tu-correo@ejemplo.com
```

Sin `--send-to` no envía mensajes. La opción `--sender` permite cambiar el remitente solo para esa prueba, sin modificar Render.

Para un operador autorizado con `RENDER_API_KEY` ya presente en el proceso:

```powershell
node scripts/diagnose-email.cjs --render-service <service_id> --workspace <workspace_id>
```

Lee únicamente la configuración de correo en memoria, verifica el workspace y muestra un resumen sin secretos. Añadir `--send-to` solicita un envío. No se guarda una copia del entorno de Render en `.env`.

Este comando se ejecuta localmente usando configuración de Render: una verificación SMTP desde ahí no demuestra conectividad desde Render. Para comprobar ese entorno se usa el endpoint autenticado de la aplicación o sus logs.

## Interpretación de fallos

| Código/síntoma | Acción |
| --- | --- |
| `SMTP_ETIMEDOUT` / Connection timeout en Render Free | Usar Resend HTTPS; no insistir cambiando contraseñas sin revisar la restricción de puertos. |
| `RESEND_KEY_DOMAIN_UNVERIFIED` | Verificar/reemplazar la clave asociada al dominio pendiente. |
| `RESEND_SENDER_DOMAIN_UNVERIFIED` | Usar una dirección de un dominio verificado. |
| `RESEND_TEST_RECIPIENT_RESTRICTED` | Restricción del remitente de prueba; configurar dominio de producción. |
| Resend 401/403 | Revisar permisos de la clave y dominio asociado sin exponerla en logs. |
| Resend 429 | Esperar/reintentar con backoff, manteniendo idempotencia. |
| `RESEND_CONNECTION_FAILED` | Conectividad o timeout; mantener el mismo identificador al reintentar. |
| `MAIL_DISABLED` | Revisar `EMAIL_ENABLED` y el flag legado `SMTP_ENABLED`. |

## Trabajos pendientes tras corregir el proveedor

- Los trabajos aún dentro de su límite se reintentan automáticamente.
- Para efectos agotados del outbox existe la herramienta de reintento de plataforma (`/api/platform/outbox/:id/retry`). Reintentar solo los efectos identificados después de corregir el proveedor.
- La cola de correo de tienda conserva sus mensajes cifrados y tiene límite de diez intentos. Los agotados requieren revisión operativa; no reenviar masivamente ni marcar como entregados manualmente.
- El éxito de recuperación de contraseña en el endpoint público no prueba envío: esa respuesta es genérica para no enumerar cuentas.

## Verificación de código

- Lint y build de backend aprobados.
- 32 pruebas relacionadas aprobadas: transporte, plantillas, compatibilidad de variables, outbox, resúmenes y portal comercial con Prisma/HTTP.
- Pruebas sin conexiones externas para TLS, fallos de red, claves restringidas, remitente no verificado, destinatario inválido y respuestas que no deben confirmarse como enviadas.

Referencias: https://render.com/docs/free y https://resend.com/docs/send-with-smtp .
