# Usar un mismo dominio de correo en varios proyectos

## Resumen

Puedes usar `qorium-investment.qpon` para enviar correos desde varios proyectos. No necesitas comprar otro dominio ni registrarlo nuevamente en Resend para cada aplicación que utilice ese mismo dominio verificado.

## Función de cada servicio

| Servicio | Responsabilidad |
| --- | --- |
| Vercel Domains / DNS | Administrar el dominio y publicar registros de autenticación SPF, DKIM y DMARC. |
| Resend | Verificar el dominio y enviar correos autorizados. |
| Cada aplicación | Usar su API key y remitente para solicitar envíos desde el backend. |

Los registros DNS pertenecen al dominio, no al proyecto. No dupliques SPF, DKIM ni DMARC porque haya dos aplicaciones. Conserva los registros que ya funcionan.

## Separación recomendada por aplicación

Por ejemplo:

```text
Proyecto Qorium:   avisos@qorium-investment.qpon
Sistema de ventas: notificaciones@qorium-investment.qpon
```

Crear una API key de envío diferente para cada aplicación, autorizada para el mismo dominio verificado. Así se puede revocar una clave sin afectar a la otra.

Verificar un dominio de envío no crea buzones para recibir respuestas. Si necesitas respuestas, configura un buzón real o un Reply-To autorizado.

## Configuración del sistema de ventas

El envío lo realiza el backend alojado en Render. Las claves deben estar en ese servicio, no en variables públicas de Next.js:

```dotenv
EMAIL_ENABLED=true
EMAIL_PROVIDER=resend
RESEND_API_KEY=<clave_exclusiva_del_sistema_de_ventas>
EMAIL_FROM_EMAIL=notificaciones@qorium-investment.qpon
EMAIL_FROM_NAME=Sistema de ventas
```

No publicar API keys en el repositorio, el navegador o conversaciones.

## Dominio web y dominio de correo

No es necesario asociar el dominio al segundo proyecto web solo para enviar correos. La web puede mantener su dirección `vercel.app` y enviar correos desde el dominio verificado.

Si además deseas usarlo para los sitios web, puedes separar subdominios:

```text
qorium-investment.qpon        → sitio del proyecto original
ventas.qorium-investment.qpon → sitio del sistema de ventas
```

Esto requiere configurar los destinos web correspondientes, pero no cambiar o eliminar la autenticación de correo existente.

## Dónde configurar DMARC

Los servidores DNS consultados para este dominio son `ns1.vercel-dns.com` y `ns2.vercel-dns.com`. Por tanto, el registro debe publicarse en la zona DNS de Vercel que administra `qorium-investment.qpon`.

1. Entrar a la sección **Domains del equipo/cuenta** en Vercel, no solo a los dominios del proyecto frontend.
2. Seleccionar `qorium-investment.qpon` y abrir DNS Records.
3. Agregar o editar un único registro:

| Campo | Valor inicial |
| --- | --- |
| Tipo | TXT |
| Name | `_dmarc` |
| Value | `v=DMARC1; p=none;` |
| TTL | Predeterminado |

El nombre completo publicado será `_dmarc.qorium-investment.qpon`. `adkim=r` y `aspf=r` son opcionales porque la alineación relajada es el valor predeterminado. No crear un segundo registro DMARC si ya existe uno.

La etiqueta “Provider: Vercel” de Resend solo identifica al proveedor DNS; no prueba que un registro se haya guardado/publicado en ese proveedor. La publicación debe confirmarse con una consulta DNS independiente.

## Inbox y spam

Que un proyecto entregue en Inbox no garantiza que todos los mensajes de otra aplicación reciban la misma clasificación. También influyen el remitente, alineación, reputación, contenido, rebotes e interacción del destinatario.

Comparar en Gmail → Mostrar original:

- Dirección/dominio From.
- Resultado SPF y dominio asociado.
- Resultado DKIM y dominio firmante.
- Resultado DMARC.

SPF y DKIM pueden pasar y, aun así, fallar DMARC si no hay alineación con el dominio del remitente o la configuración no es válida. Publicar una política inicial no garantiza por sí solo la bandeja de entrada.

Usar remitentes estables, evitar direcciones de prueba inventadas que reboten y marcar como “No es spam” los mensajes legítimos recibidos. Endurecer DMARC a quarantine/reject solo después de validar todos los emisores legítimos.

## SMTP de Google

SMTP de Google es una alternativa, pero no garantiza Inbox. El plan Free de Render bloquea los puertos SMTP habituales 25, 465 y 587. Para el despliegue actual se usa Resend HTTPS.

Gmail personal debe utilizar una cuenta/remitente autorizado y su autenticación correspondiente. Usar una dirección del dominio propio mediante Google normalmente requiere configurar ese dominio en Google Workspace y publicar los registros que Google indique. Cambiar de proveedor no elimina la necesidad de autenticación del dominio.

## Referencias

- Guía operativa de esta aplicación: [operacion-correo.md](operacion-correo.md).
- https://vercel.com/docs/domains/managing-dns-records
- https://resend.com/docs/dashboard/domains/dmarc
- https://render.com/docs/free
