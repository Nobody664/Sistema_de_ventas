# Pagos, eliminación con CSRF y separación plataforma/negocio

## Modelo de acceso

- `SUPER_ADMIN` administra el sistema desde `/platform`: su identidad no tiene empresa, plan ni pagos propios. El login, la renovación y `/auth/me` mantienen ese contexto global incluso si existen membresías históricas en la BD.
- `COMPANY_ADMIN` administra un negocio: su sesión identifica la empresa y su suscripción. Sus lecturas y operaciones siguen usando el tenant validado por el backend.
- Las herramientas globales no se convierten en consultas de empresa sin filtro. Los guards de tenant, permisos, estado de empresa y CSRF siguen activos.

## Navegación y consultas

`getPlatformDestination` centraliza la traducción de enlaces de negocio para perfiles de plataforma. Se aplica al destino de login y en el proxy antes de renderizar o consultar datos de empresa:

| Enlace de negocio abierto por Super Admin                       | Destino global                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/dashboard`                                                    | `/platform`                                                                   |
| `/subscription`, `/checkout`                                    | `/platform/plans`                                                             |
| `/payments`                                                     | `/platform/finanzas`                                                          |
| `/settings/company`                                             | `/platform/companies`                                                         |
| `/notifications`                                                | `/platform/notifications`                                                     |
| `/support/*`                                                    | `/platform/support`                                                           |
| Productos, categorías, ventas, empleados, clientes e inventario | `/platform`, desde donde se seleccionan las herramientas globales disponibles |

Perfil y configuración compartidos usan `PlatformShell` para los administradores globales, sin cargar capacidades de un plan personal. Configuración no monta el indicador del perfil de empresa ni ofrece sus datos de negocio. El perfil global enlaza directamente a plataforma.

La lectura de roles del proxy orienta redirecciones; la validación de identidad y autorización sigue siendo del backend. La identidad de plataforma se determina a partir del rol actual de BD, no del rol declarado por un token antiguo.

## Pagos de Company Admin

- `/payments` consulta únicamente `/billing/status`, que contiene suscripción, pago pendiente e historial reciente. Se eliminaron las consultas adicionales no utilizadas que podían responder HTTP 200 vacío y bloquear la pantalla.
- La ausencia de suscripción es un estado vacío explícito; no se interpreta como un error ni se asigna un plan inventado.
- La API de billing proyecta el estado del comprobante por `paymentId`. No carga imágenes de comprobantes en esa consulta y no interpreta comprobantes históricos sin enlace como confirmación de otro pago.
- El cliente muestra comprobantes en revisión, permite reenviar los rechazados y diferencia enviar un comprobante de confirmar el cobro. La confirmación del pago sigue siendo una operación de plataforma.
- La ruta y el enlace de Mis pagos se limitan a `COMPANY_ADMIN`, coherentemente con el endpoint de billing. Las restricciones de estado de empresa existentes permanecen vigentes.

## Eliminaciones y CSRF

`apiFetch` ahora establece `Content-Type: application/json` para DELETE/POST/PATCH/PUT aunque no tengan cuerpo. Conserva las cabeceras explícitas y no etiqueta FormData como JSON. Así las eliminaciones de categorías y las demás mutaciones sin cuerpo cumplen el contrato del guard CSRF, que no fue desactivado ni relajado.

## Verificación

- Backend: lint, **316 pruebas aprobadas** y build correcto.
- Frontend: lint, **47 pruebas aprobadas** y build Webpack correcto.
- Chromium: **13 comprobaciones aprobadas**, incluyendo:
  - Super Admin sin empresa ni plan, login directo a plataforma y enlaces antiguos sin consultas tenant.
  - Perfil/configuración global sin llamadas a suscripción, billing o perfil de empresa.
  - Mi plan con y sin solicitud pendiente.
  - Mis pagos con deuda, sin deuda, sin suscripción y con comprobante en revisión.
  - Eliminación de la categoría sintética “Galletas” con cabecera JSON y rechazo simulado si faltara.
- Las pruebas usan datos sintéticos y servicios simulados; no eliminan categorías reales ni modifican identidades de producción.

No se modificó el esquema de Prisma y no se requieren nuevas migraciones.
