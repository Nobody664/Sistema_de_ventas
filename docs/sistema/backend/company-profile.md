# Módulo: Company Profile

## Propósito
Calcula y reporta el grado de completitud del perfil de una empresa (RUC, razón social,
dirección, teléfono, email) y sugiere al administrador completar los datos faltantes mediante
notificaciones in-app. Incluye un cron diario que recorre empresas activas/en prueba y envía
recordatorios.

## Archivos clave
- `backend/src/modules/company-profile/company-profile.controller.ts` — endpoint de lectura de completitud del perfil.
- `backend/src/modules/company-profile/company-profile.service.ts` — cálculo de completitud, campos faltantes, sugerencias y cron diario.
- `backend/src/modules/company-profile/company-profile.module.ts` — registra controller y service; importa `PrismaModule` y `NotificationsModule`; exporta `CompanyProfileService`.
- `backend/src/common/helpers/profile-completeness.helper.ts` — `PROFILE_FIELDS`, `evaluateProfile`, `isProfileComplete` (reglas de completitud compartidas con `CompaniesService`).

## Endpoints

Notas de guards:
- Globales (registrados en `app.module.ts`): `CsrfGuard`, `ThrottlerGuard` (60 req/min por defecto), `JwtAuthGuard`, `RolesGuard`, `PlanCapabilitiesGuard`.
- `CompanyProfileController` aplica `@UseGuards(JwtAuthGuard, TenantGuard)` **a nivel de clase**.
- No usa `@Roles`, `@Permissions`, `@RequireModule`, `@RequireFeature`, `@RequirePlan` ni `@LimitResource`.
- Throttling: sin override (límite global 60/min).

### GET /api/company-profile/completeness
- **Descripción**: Devuelve la evaluación de completitud del perfil de la empresa del tenant.
- **Auth**: JWT (global).
- **Plan**: ninguno.
- **Guards extra**: `TenantGuard` (a nivel de clase); exige `companyId` en el token y bloquea `SUSPENDED`/`INACTIVE`/`PAST_DUE`.
- **Path params**: ninguno.
- **Query**: ninguno.
- **Body**: ninguno.
- **Respuesta**:
  - Si `request.tenantId` no está definido, el controller cortocircuita y devuelve `{ score: 100, totalFields: 0, completedFields: 0, missingFields: [], complete: true }` (sin llamar al servicio).
  - En caso contrario, `{ score, totalFields, completedFields, missingFields, complete }`, donde `missingFields` es un array de etiquetas (`'RUC'`, `'Razón Social'`, `'Dirección'`, `'Teléfono'`, `'Email'`) y `score` es la suma de pesos (máx. 100).
- **Efectos secundarios**: ninguno (solo lectura).
- **Errores**: `403` de tenant (mensajes específicos del `TenantGuard`).

## Funciones del servicio (`CompanyProfileService`)

### `getProfileCompleteness(companyId: string)`
- **Qué hace**: Lee los campos de perfil de la empresa (`taxId`, `legalName`, `address`, `phone`, `email`) y los evalúa con `evaluateProfile`.
- **Escribe en**: ninguna tabla (solo lectura).
- **Devuelve**: `{ score, totalFields, completedFields, missingFields, complete }`; si la empresa no existe, `{ score: 0, totalFields: PROFILE_FIELDS.length, completedFields: 0, missingFields: <todas las etiquetas>, complete: false }`.
- **Lanza**: ninguna excepción.

### `getMissingFields(companyId: string): Promise<ProfileField[]>`
- **Qué hace**: Devuelve los `ProfileField` cuyo valor en la empresa no pasa su validador.
- **Escribe en**: ninguna tabla (solo lectura).
- **Devuelve**: array de `ProfileField`; si la empresa no existe, `PROFILE_FIELDS` completo.
- **Lanza**: ninguna excepción.

### `sendCompletionSuggestions(companyId: string, userId: string): Promise<number>`
- **Qué hace**: Para cada campo faltante cuyo recordatorio no se haya enviado en los últimos 30 días (control de deduplicación), crea una notificación in-app al `userId` con título/mensaje según `FIELD_MESSAGES` (fallback genérico si no hay mensaje específico). El `data` de la notificación incluye `{ field, action: '/settings/company' }`.
- **Escribe en**: `notifications`.
- **Devuelve**: cantidad de notificaciones enviadas (`number`).
- **Lanza**: ninguna excepción (espera errores de `NotificationsService.create` propagados si ocurren).

### `checkCompanyProfiles()` (cron `@Cron(CronExpression.EVERY_DAY_AT_8AM)`)
- **Qué hace**: Tarea programada que recorre las empresas con `status` en `['ACTIVE', 'TRIAL']`, toma el primer `COMPANY_ADMIN`, y si la completitud es menor a 100 llama a `sendCompletionSuggestions`. Registra en log el total enviado.
- **Escribe en**: `notifications` (indirectamente vía `sendCompletionSuggestions`).
- **Devuelve**: `totalSent` (`number`).
- **Lanza**: ninguna excepción propia.

Método privado: `shouldNotify(companyId, field)` — comprueba si existe una `notification` de tipo `SYSTEM` con `data.field === field` creada en los últimos 30 días (`false` si existe, `true` si no).

## Notas sobre el helper `profile-completeness.helper.ts`
- `PROFILE_FIELDS` define los campos evaluados, su etiqueta y peso:

| key | label | weight | valida cuando |
|-----|-------|--------|----------------|
| `taxId` | `RUC` | 30 | string no vacío que cumple `/^\d{11}$/` |
| `legalName` | `Razón Social` | 25 | string con longitud `>= 3` |
| `address` | `Dirección` | 20 | string con longitud `>= 10` |
| `phone` | `Teléfono` | 15 | string no vacío |
| `email` | `Email` | 10 | string que contiene `@` |

- `evaluateProfile(company)` devuelve `{ score, totalFields (5), completedFields, missingFields, complete }`; `complete` es `true` solo si los 5 campos validan.
- `isProfileComplete(company)` es un atajo de `evaluateProfile(company).complete` y lo usa `CompaniesService.profileSync` al crear/actualizar empresas.
- Los canales de notificación provienen de `NotificationChannel` (`notifications.service.ts`); este módulo usa `IN_APP`.
