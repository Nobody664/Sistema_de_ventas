# Acceso a Mi plan y a la plataforma

## Fallos reproducidos

1. El login enviaba todos los perfiles a `/dashboard`. Esa página consultaba `/dashboard/tenant` incluso para `SUPER_ADMIN` sin empresa, provocando un 403 por falta de contexto tenant. Los logs de producción también mostraban ese rechazo.
2. `/subscription` solicitaba el plan actual y una solicitud de cambio pendiente. La ausencia de solicitud es válida, pero Nest/Express responde con HTTP 200 sin cuerpo al devolver `null`; el wrapper SSR lo clasificaba como JSON inválido y bloqueaba toda la pantalla.
3. Cuando sí existía una solicitud, la pantalla esperaba `currentPlan` y `newPlan`, mientras el endpoint devuelve `plan` como destino solicitado. Eso provocaba un error al renderizarla.

Los tres casos se reprodujeron en Chromium con el build anterior y datos sintéticos, antes de aplicar las correcciones.

## Requisitos por ruta y perfil

| Ruta            | Perfil y contexto                                  | Datos necesarios                                                                                                                                                                                                                                           |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/platform`     | `SUPER_ADMIN` o `SUPPORT_ADMIN`, con sesión válida | No necesita `companyId` ni una suscripción propia.                                                                                                                                                                                                         |
| `/dashboard`    | Usuario de negocio con contexto de empresa         | Métricas tenant de su empresa. Los administradores de plataforma se redirigen a `/platform` antes de consultar métricas tenant.                                                                                                                            |
| `/subscription` | `COMPANY_ADMIN` con `companyId` y sesión válida    | Suscripción actual, catálogo de planes, perfil de empresa y solicitud pendiente si existe. No exige una solicitud de cambio ni tener el perfil completo para mostrar el plan. La validación del estado de empresa sigue vigente en proxy/layout y backend. |
| `/profile`      | Usuario autenticado                                | El perfil de plataforma usa datos globales; el perfil de negocio consulta empresa y suscripción actual, que puede estar ausente.                                                                                                                           |

La autorización real y el alcance de empresa siguen siendo responsabilidad del backend. Las redirecciones de interfaz no conceden acceso a recursos protegidos.

## Corrección

- `lib/role-navigation.ts` centraliza el destino inicial: plataforma para administradores globales y dashboard para usuarios de negocio. Conserva la validación contra redirecciones externas y evita enviar a un usuario de negocio a rutas de plataforma después del login.
- `/dashboard` comprueba la sesión y redirige a los perfiles de plataforma antes de consultar datos de empresa, también al entrar directamente por URL.
- Un administrador de plataforma sin empresa que abre `/subscription` vuelve a `/platform`, en lugar de entrar en un bucle de login.
- `serverApiFetch` admite `allowEmpty` únicamente cuando el llamador declara que la respuesta es opcional. Se usa en suscripción actual y solicitud pendiente; los errores 401/403/500 y el JSON malformado siguen siendo errores.
- El contrato `PendingPlanUpgrade` refleja el campo `plan` de la API. La pantalla muestra como origen el plan actual y como destino el plan solicitado.
- Si no existe suscripción, se muestra “Sin suscripción”, en lugar de afirmar que el usuario pertenece al plan Free.

## Verificación

- `npm run lint`: correcto.
- `npm test`: **43 pruebas aprobadas**.
- `node node_modules/next/dist/bin/next build --webpack`: correcto, 62 rutas.
- `npm run test:browser:refix`: **8 comprobaciones aprobadas**, incluidas:
  - Login y entrada directa a dashboard con `SUPER_ADMIN` sin empresa: termina en plataforma y no consulta métricas tenant.
  - `COMPANY_ADMIN` con plan activo y sin solicitud pendiente: muestra Mi Plan.
  - `COMPANY_ADMIN` con solicitud pendiente: muestra el destino real solicitado.

Las pruebas de navegador usan backend simulado y cuentas sintéticas; no se accedió a cuentas reales ni se modificaron sus roles o suscripciones.
