# Refix backend — Fase 1: B-01 a B-04

## Rama y organización

- Base: `refix/backend`.
- Rama de implementación: `refix/backend-fase-1`.
- Git no admite simultáneamente la referencia `refix/backend` y una referencia hija `refix/backend/Fase-1`. Se conserva la rama base y se utiliza el sufijo `-fase-N`.
- Esta fase implementa las primeras cuatro tareas del informe backend y las correcciones de contrato necesarias para sus consumidores frontend.

| Fase backend | Hallazgos principales  | Estado                                                                                                                |
| ------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1            | B-01, B-02, B-03, B-04 | Implementada y verificada localmente.                                                                                 |
| 2            | B-05, B-06, B-07, B-08 | Pendiente. La reclamación atómica del refresh se adelantó por su relación con sesiones; B-05 aún incluye otros casos. |
| 3            | B-09, B-10, B-11, B-12 | Pendiente.                                                                                                            |
| 4            | B-13, B-14, B-15, B-16 | Pendiente.                                                                                                            |
| 5            | B-17, B-18, B-19, B-20 | Pendiente.                                                                                                            |
| 6            | B-21, B-22, B-23, B-24 | Pendiente.                                                                                                            |

La planificación de frontend mantiene bloques F-01–F-04, F-05–F-08, F-09–F-12 y F-13–F-16 desde `refix/frontend`. Se debe integrar primero el contrato backend necesario para cada bloque. En esta fase se corrigió el contrato público de `/auth/me`, parte del hallazgo F-02, sin modificar pantallas ni stores.

## B-01: confirmación de cobros de suscripción

### Política de acceso

- La empresa puede enviar comprobantes; no puede declarar recibido un cobro de plataforma.
- `PATCH /api/payments/:id/mark-paid` ahora exige SUPER_ADMIN, PlatformGuard y permiso `PLATFORM_FINANCE_MANAGE`. Se mantiene como ruta compatible restringida.
- Nueva ruta de plataforma: `POST /api/platform/finance/payments/:id/confirm`, con el mismo permiso.
- Ambas rutas usan un DTO que exige un motivo de confirmación y permite una fecha de pago válida no futura.
- El tenant se obtiene del pago persistido. No se acepta un `companyId` del cliente para decidir qué empresa activar.
- El servicio vuelve a verificar que el revisor sea un usuario SUPER_ADMIN activo, independientemente de los claims recibidos.

Ejemplo de cuerpo administrativo:

```json
{
  "reason": "Abono bancario contrastado con el comprobante",
  "paymentDate": "2026-10-24T00:00:00.000Z"
}
```

### Consistencia

`SubscriptionSettlementService` centraliza la confirmación de pago, renovación y auditoría. Las escrituras se ejecutan en una transacción SERIALIZABLE, con reclamación condicional de `PENDING` a `SUCCEEDED` y reintentos acotados de conflictos PostgreSQL/Prisma P2034.

- El mismo pago no extiende dos veces la suscripción.
- Un fallo de suscripción/auditoría revierte también la confirmación.
- Una operación ya confirmada devuelve `alreadyProcessed: true` sin repetir la renovación.
- Los cobros MercadoPago no se pueden marcar como recibidos mediante confirmación manual: deben pasar por verificación del proveedor.
- Las renovaciones del mismo plan conservan el período ya pagado; los límites de mes/año se calculan en UTC y se ajustan al último día válido.
- Pagar no levanta automáticamente `Company.status = SUSPENDED`, porque el modelo no distingue suspensión administrativa de otras causas. Plataforma debe resolver esa suspensión por la acción administrativa correspondiente. Esta política evita que un cobro deshaga un bloqueo administrativo.

Se mantienen los avisos de cobro después del commit. Si falla un aviso, se registra el fallo y no se revierte ni se presenta como fallido un cobro ya confirmado. La entrega durable mediante outbox sigue pendiente dentro del tratamiento de B-16.

## B-02: webhook e intención de cobro MercadoPago

### Intención persistida

Antes de solicitar la preferencia se crea un Payment PENDING con:

- `transactionId`: referencia aleatoria generada por el servidor.
- Importe y moneda esperados.
- Suscripción asociada y empresa de esa suscripción.
- Snapshot en `providerPayload` con `kind = MERCADOPAGO_CHECKOUT`, `companyId`, `planId` y `billingCycle`.

La referencia aleatoria se envía como `external_reference`. Se abandona la activación basada en separar `companyId_planCode` de una cadena notificada.

### Verificación de la notificación

1. Solo se admite el proveedor implementado.
2. Se valida HMAC SHA-256 utilizando el manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, comparación de bytes en tiempo constante y ventana temporal acotada. Se aceptan timestamps en segundos o milisegundos.
3. Se rechazan identificadores contradictorios entre query plana, query anidada y el recurso del cuerpo.
4. El cuerpo no decide estado, empresa, importe ni plan. El ID firmado se consulta mediante el access token del servidor en el endpoint fijo HTTPS `/v1/payments/:id` de MercadoPago.
5. El beneficiario se contrasta contra `/users/me`, consultado con la misma credencial y cacheado brevemente. En producción se rechazan pagos sandbox.
6. Para un pago aprobado, se busca la intención por su referencia interna y se contrastan importe, moneda y tenant del snapshot.
7. El estado, la suscripción y la auditoría se confirman en la misma transacción. El ID del pago del proveedor es único; los reenvíos no renuevan de nuevo.

`MercadoPagoGateway` mantiene separadas las llamadas al proveedor, valida la forma de las respuestas, impone timeout y no sigue redirecciones en las consultas de verificación. El destino de checkout debe ser HTTPS y pertenecer a los dominios de MercadoPago admitidos.

### Contrato de errores y reintentos

- Firma/recurso inválidos: 401/400, sin activación.
- Credenciales no configuradas: 503.
- Proveedor inaccesible o respuesta incompleta: 502 para permitir un reintento posterior, sin afirmar éxito.
- Tópico no implementado o pago todavía no aprobado: respuesta recibida con `processed: false`.
- Operación aprobada ya aplicada: `processed: true`, `alreadyProcessed: true`.

Documentación oficial contrastada durante la implementación:

<https://www.mercadopago.com.pe/developers/es/docs/your-integrations/notifications/webhooks>

### Compatibilidad de pagos anteriores

Las preferencias creadas antes de esta fase no tienen la intención interna verificable. No se activan interpretando libremente sus referencias antiguas. Para un checkout todavía no pagado, se debe generar una nueva preferencia. Si una operación anterior ya recibió dinero, se debe reconciliar explícitamente con el proveedor y sus datos históricos; no se debe eludir la verificación inventando un snapshot o convirtiendo el cobro online en manual.

No se ejecutaron cobros reales, solicitudes con credenciales productivas ni pruebas de sandbox contra MercadoPago durante esta fase. Falta verificar el recorrido extremo a extremo en una cuenta de pruebas y sus notificaciones reales.

## B-03: FAQs globales, privadas y feedback

### Política implementada

| Acción                        | Empresa autorizada a gestionar FAQs            | Plataforma                                |
| ----------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Leer FAQ publicada GLOBAL     | Permitido.                                     | Permitido.                                |
| Leer FAQ publicada TENANT     | Solo su empresa.                               | Permitido según consulta administrativa.  |
| Leer borradores               | Denegado por el endpoint de lectura ordinario. | Permitido administrativamente.            |
| Crear FAQ sin scope explícito | TENANT de la sesión.                           | GLOBAL.                                   |
| Crear/editar/eliminar GLOBAL  | Denegado.                                      | Permitido con permisos de FAQ/plataforma. |
| Crear/editar/eliminar TENANT  | Solo su empresa.                               | Requiere empresa válida al crear.         |
| Feedback                      | Solo sobre contenido publicado accesible.      | Solo publicado.                           |

- La autorización de escritura ya no reutiliza la regla de lectura de GLOBAL.
- No se permite que un actor de empresa elija otro tenant en el payload/query.
- `findById` aplica publicación y alcance en la consulta.
- Feedback recibe el actor, modifica con el alcance autorizado dentro de la transacción y devuelve solo `id`, `helpfulCount` y `notHelpfulCount`.
- El endpoint de feedback ya no devuelve pregunta/respuesta de una FAQ privada de otra empresa.

### Rutas administrativas sin tenant

- `GET /api/platform/support/faqs`
- `POST /api/platform/support/faqs`
- `PATCH /api/platform/support/faqs/:id`
- `DELETE /api/platform/support/faqs/:id`

Se exige `PLATFORM_SUPPORT_MANAGE` y el permiso específico de lectura/gestión de FAQs. El listado admite `publication=published|draft|all`; publicado es el valor por defecto. La gestión se audita y no depende de seleccionar una empresa para trabajar con GLOBAL.

## B-04: identidad vigente, sesiones y empleados

### Validación de peticiones

El JWT sigue validándose criptográficamente con Passport. Después, la estrategia obtiene una proyección mínima de identidad actual en BD:

- Usuario existente y activo.
- Familia de sesión activa y no expirada, ligada al usuario y al mismo contexto de empresa del token.
- Membresía activa del tenant solicitado.
- Estado del empleado, cuando corresponde a esa empresa.
- Roles globales y de membresía actuales; los roles antiguos del JWT no conceden permisos.
- Estado actual de empresa, plan y suscripción para la respuesta de sesión.

Los permisos de seguridad no se resuelven desde una caché local de proceso. Las comprobaciones son consistentes entre réplicas que usan la misma BD. Se añade un índice por familia/revocación para las consultas de sesión.

### Familia de sesión y renovación

- Los nuevos access tokens incorporan `sid`, correspondiente a la familia persistida de refresh tokens.
- Logout/revocación de la familia hacen que los access tokens de esa familia dejen de ser válidos en nuevas peticiones.
- La renovación no conserva el tenant anterior si la membresía fue eliminada o revocada.
- Login y refresh rechazan usuarios inactivos.
- Se adelantó la reclamación atómica del refresh: el token debe seguir sin revocar y sin expirar dentro de la transacción antes de crear su reemplazo.
- Al actualizar perfil se conserva la familia y el contexto de la sesión; no se cambia implícitamente a otra empresa.

Los access tokens antiguos sin `sid` deben renovarse. Un cliente capaz de utilizar el refresh vigente puede obtener el contrato nuevo; los recorridos SSR del frontend todavía pendientes de F-04 pueden requerir volver a iniciar sesión. La validación periódica de conexiones SSE ya abiertas corresponde a B-20 y no queda resuelta únicamente por comprobar nuevas peticiones HTTP.

### Contrato `/auth/me`

La API devuelve un DTO público con `id`, email, nombre, roles, empresa, estado, plan, suscripción y vencimiento de prueba. No retorna `sid` ni los detalles internos de la familia. Se mantiene `sub` internamente para los controladores, pero no se hace pasar un payload JWT sin normalizar por el modelo público esperado por frontend.

### Sincronización de empleados

- Crear/vincular/editar un empleado sincroniza el rol y estado de su Membership.
- Cambios de rol/actividad y eliminación revocan las sesiones de ese usuario en ese tenant, sin afectar innecesariamente a otras empresas.
- El empleado, la membresía y las revocaciones se modifican de forma transaccional.
- Los cambios sensibles usan aislamiento SERIALIZABLE; se impide dejar la empresa sin su último administrador activo.
- Una edición de perfil sin cambios de acceso no revoca sesiones por sí sola.
- No se permite enlazar un usuario globalmente inactivo ni editar como activo un empleado ya eliminado mediante el flujo normal de actualización.

## Archivos principales

- `backend/src/modules/payments/subscription-settlement.service.ts`
- `backend/src/modules/payments/mercado-pago.gateway.ts`
- `backend/src/modules/payments/payments.service.ts`
- `backend/src/modules/payments/payments.controller.ts`
- `backend/src/modules/support/support-faq.service.ts`
- `backend/src/modules/support/support-faq.controller.ts`
- `backend/src/modules/platform/platform-support.controller.ts`
- `backend/src/modules/auth/jwt.strategy.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/employees/employees.service.ts`
- Helpers de transacción serializable y cálculo de período de suscripción.

## Migración

Se incluye `backend/prisma/migrations/20261031000000_index_session_families/migration.sql`. Solo añade el índice `refresh_tokens_family_id_revoked_at_idx`; no modifica datos de negocio ni exige columnas nuevas para el contrato `sid`.

Se ejecutaron `prisma validate` y `prisma generate`. La migración se deja preparada para el despliegue de esta fase: **no se ejecutó `migrate deploy` contra la base compartida durante estas mitigaciones**.

## Verificación realizada

- `npm run lint`: aprobado.
- `npm run build`: aprobado.
- Suite completa con `node -r ts-node/register -r tsconfig-paths/register --test --test-concurrency=2 "src/**/*.spec.ts"`: **208 pruebas aprobadas, 65 suites, 0 fallos**.
- Incluye HTTP real local con Passport/JWT y ValidationPipe; base de datos y efectos de negocio simulados.
- Incluye pruebas de rechazo de roles de empresa, roles elevados obsoletos en JWT, usuario inactivo y sesión revocada.
- Incluye firma alterada, cuerpo no autoritativo, tópico no soportado, beneficiario incorrecto, sandbox en producción y errores del proveedor.
- Incluye confirmación repetida, atomicidad de activación/auditoría, moneda/importe incorrectos, suspensión administrativa y fechas de fin de mes/año.
- Incluye FAQs GLOBAL/TENANT, borradores, feedback restringido y ausencia de contenido privado en su respuesta.
- Incluye sincronización de membresías, rollback, revocación y protección del último administrador.

Las pruebas de concurrencia del dominio usan un repositorio transaccional simulado que verifica fronteras, idempotencia y rollback. No sustituyen un ensayo concurrente con PostgreSQL real. Ese ensayo y el pago E2E de sandbox deben realizarse antes de publicar esta fase en producción.

## Próxima fase

Continuar B-05 a B-08 en `refix/backend-fase-2`, una vez consolidada la Fase 1: consumo completo de tokens de reset/refresh, visibilidad de ventas en todas las rutas, importes/precios por presentación y recepción atómica de compras. Las correcciones parciales adelantadas se deben conservar y ampliar, no duplicar.
