# Diagnóstico y mejora del inicio de sesión

## Síntoma

La pantalla de acceso mostraba “La solicitud tardó demasiado. Intenta nuevamente.” y el usuario debía intentar dos o tres veces antes de entrar.

## Hallazgos

1. El cliente HTTP abortaba peticiones a los 20 segundos. El login utilizaba ese presupuesto general.
2. El backend está en Render Free, que puede detenerse por inactividad y volver a arrancar al recibir tráfico. Los logs muestran arranques de nuevas instancias separados en el tiempo, sin que todos correspondan a despliegues nuevos.
3. Con el backend activo, una medición puntual de salud devolvió aproximadamente 652 ms directo a Render y 1690 ms mediante el proxy del frontend. Esta medición no reproduce un arranque en frío ni demuestra la duración de una autenticación real con credenciales.
4. El patrón de fallar la primera solicitud y funcionar después es compatible con el arranque en frío superando el timeout del cliente. No se dispone de una traza del intento exacto de la captura para atribuirle toda su demora exclusivamente a esa causa.
5. Se comprobó además una carrera en el estado de autenticación: `checkAuth()` se inicia al montar la aplicación. Su respuesta antigua podía llegar después de un login y borrar/reemplazar la sesión recién iniciada.
6. El timeout HTTP terminaba al recibir cabeceras, antes de terminar de leer el JSON. Una respuesta con cuerpo pendiente quedaba fuera de ese control.

## Corrección implementada

### Preparación del backend

Antes de enviar credenciales, `frontend/lib/auth-readiness.ts` consulta `/api/health/ready`:

- Solo GET idempotentes, sin cuerpo ni cookies de sesión.
- Presupuesto total de preparación: 90 segundos.
- Cada sondeo tiene un timeout de hasta 10 segundos y separación de 1,5 segundos entre intentos.
- Requiere JSON de salud del backend y PostgreSQL disponible. Una página HTML de “arrancando” no se considera lista.
- Admite `degraded` si la base de datos está bien: Redis es opcional para este flujo.
- Errores de configuración, acceso o rate limit (400/401/403/404/429) detienen la preparación; no se insiste en enviar credenciales.
- La respuesta de readiness tiene `Cache-Control: no-store`.
- No hay un ping periódico para mantener artificialmente activo el servicio: los sondeos solo existen mientras el usuario solicita acceso.

### Un único login

Después de verificar disponibilidad se envía **un solo POST** `/auth/login`, con presupuesto de 30 segundos y sin reintentos automáticos de contraseña ni refresh de autenticación.

Los 20 segundos generales se conservan para las otras peticiones, salvo presupuestos específicos existentes. El tiempo de preparación no consume el presupuesto del POST.

El control del timeout ahora incluye recibir cabeceras, leer el cuerpo y procesar la respuesta. La renovación de sesión también tiene un timeout acotado.

### Experiencia de la pantalla

- Estado “Conectando con el servidor…” durante la preparación, con explicación del reposo y botón para cancelar la espera.
- Estado “Verificando acceso…” después de enviar las credenciales.
- Botón y campos deshabilitados mientras la operación está en curso; protección contra doble submit incluso antes de un render de React.
- Cancelar durante preparación no envía la contraseña. Navegar fuera aborta la operación del cliente.
- Los errores de credenciales se muestran como tales; no se reinterpretan como arranque en frío.

### Estado de sesión coherente

`auth.store.ts` versiona las operaciones. Los resultados de `checkAuth` anteriores a un login/logout/registro/cambio de perfil no pueden sobrescribir el resultado nuevo. Entre comprobaciones concurrentes se conserva la vigente.

La validación de contraseña con Argon2, roles, tenant, revocación y cookies no se debilita ni se omite.

## Observabilidad del backend

- `/auth/login` incorpora `Server-Timing: auth;dur=<milisegundos>` para medir la ejecución del controlador, incluyendo base de datos y verificación de credenciales.
- `AuthService` registra una advertencia si la autenticación tarda al menos cinco segundos, sin incluir email, contraseña ni tokens.

Esto permite distinguir en una revisión futura:

| Observación | Interpretación |
| --- | --- |
| Preparación lenta y `auth;dur` corto | Arranque/conexión previa, no cálculo de credenciales. |
| `auth;dur` alto con readiness rápido | Investigar consultas, pool, CPU y concurrencia del backend. |
| 401 rápido | Rechazo de credenciales/estado de cuenta, no timeout. |
| 429 | Límite de solicitudes; esperar en vez de repetir el botón. |
| Readiness 503 persistente | Revisar PostgreSQL/dependencias; no enviar credenciales a ciegas. |

## Verificaciones

- 94 pruebas frontend aprobadas.
- 40 pruebas backend relacionadas con autenticación, tokens, roles, readiness y seguridad HTTP aprobadas.
- Lint y builds de ambos proyectos aprobados.
- `npm run test:browser:auth`: preparación simulada de servidor en reposo y autenticación superiores al antiguo umbral de 20 segundos, un único POST, cancelación sin credenciales y ausencia de reintento automático tras 401.
- `npm run test:browser:refix`: regresión de CSP, controles hidratados, navegación, permisos, roles de plataforma/empresa y operaciones administrativas aprobada.
- Pruebas unitarias de respuesta tardía de `checkAuth` después de login/logout y de timeout durante lectura del cuerpo HTTP.

Los ensayos de navegador usan un API controlado para reproducir las demoras. No se solicitó ni utilizó la contraseña de la cuenta que aparece en la captura.

## Resultado y límite operativo

El usuario puede iniciar una única operación y esperar el despertar del servidor con progreso visible. No debe pulsar varias veces para compensar el timeout de arranque.

El código no convierte Render Free en una instancia permanentemente activa. Para eliminar la espera inicial de infraestructura se necesita evaluar un plan que permanezca activo. Esa decisión de costo no se aplica automáticamente.

Si después del despliegue sigue habiendo demoras con el servidor ya activo, revisar el valor `Server-Timing`, las advertencias de login lento y los tiempos de base de datos, sin registrar secretos ni repetir intentos de autenticación de forma masiva.

## Guía de correo solicitada

Las instrucciones de dominio compartido, Vercel DNS, Resend, remitentes por aplicación, API keys y SMTP de Google están en [dominio-compartido-correo.md](dominio-compartido-correo.md).
