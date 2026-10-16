# Módulo: DNI (consulta RENIEC/SUNAT)

## Propósito
Consulta de identidad por DNI (RENIEC) y por RUC (SUNAT) a través de proveedores externos vía `fetch`.
Es una función sujeta a plan: requiere el módulo `api_search_dni` y la feature `api.dni_search`, y
consume cuota de API por cada llamada.

## Archivos clave
- `backend/src/modules/dni/dni.controller.ts` — controller `dni` (endpoints `/:dni` y `/ruc/:ruc`).
- `backend/src/modules/dni/dni.service.ts` — `DniService` (`findByDni`, `findByRuc`), llamadas HTTP externas.
- `backend/src/modules/dni/dni.module.ts` — declara `DniController`; provee y exporta `DniService`.

Contexto complementario: [`plan-capabilities.md`](./plan-capabilities.md) (`ApiQuotaGuard`, `ApiQuotaService`).

## Endpoints

Ambos endpoints comparten la configuración de clase del controller:
- `@UseGuards(JwtAuthGuard, ApiQuotaGuard)` a nivel de `@Controller('dni')`.
- `@RequireModule('api_search_dni')` y `@RequireFeature('api.dni_search')` (evaluados por el `PlanCapabilitiesGuard` global).
- `@Throttle({ default: { limit: 30, ttl: 60_000 } })` — 30 solicitudes por 60 s por endpoint.
- No tiene `@Public()`: aplica el `JwtAuthGuard` global.

### GET /api/dni/:dni
- **Descripción**: consulta los datos de una persona por DNI en el proveedor RENIEC.
- **Auth**: JWT (guard global y `@UseGuards`) + `@Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')`.
- **Plan**: `@RequireModule('api_search_dni')` + `@RequireFeature('api.dni_search')` (gating por capacidades de plan).
- **Guards extra**: `JwtAuthGuard`, `ApiQuotaGuard` (a nivel de clase).
- **Path params**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|-----------|-------------|
  | `dni` | string | sí | `DniService` valida 8 dígitos (`/^\d{8}$/`) | Documento de identidad a consultar. |

- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta** (`DniResponse`): `{ dni, nombres, apellidoPaterno, apellidoMaterno, direccion?, sexo?, fechaNacimiento? }`. Los campos ausentes se normalizan a cadena vacía (`''`) salvo los opcionales.
- **Efectos secundarios**: `ApiQuotaGuard` consume 1 unidad de cuota de API (escribe `api_usage`, excepto para admins globales y usuarios sin `companyId`). No escribe auditoría.
- **Errores**:
  - `400 BadRequestException('DNI debe tener 8 dígitos')` si el formato es inválido.
  - `404 NotFoundException('DNI no encontrado en RENIEC')` si el proveedor responde 404.
  - `400 BadRequestException('Error de autenticación con RENIEC')` si el proveedor responde 401.
  - `400 BadRequestException('Error al consultar DNI: <status>')` para otros estados HTTP.
  - `400 BadRequestException('Tiempo de conexión agotado con RENIEC')` si el `fetch` se aborta (timeout 10 s).
  - `400 BadRequestException('Error al consultar DNI')` como error genérico.
  - Del `ApiQuotaGuard`: `403 FEATURE_NOT_AVAILABLE` (`apiEnabled` falso o `apiQuota <= 0`) y `429 API_QUOTA_EXCEEDED`.
  - Del `PlanCapabilitiesGuard`: `403 MODULE_NOT_ENABLED` si falta `api_search_dni` y `403 FEATURE_NOT_AVAILABLE` si falta `api.dni_search`.

### GET /api/dni/ruc/:ruc
- **Descripción**: consulta los datos de una empresa por RUC en el proveedor SUNAT.
- **Auth**: JWT (guard global y `@UseGuards`) + `@Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')`.
- **Plan**: `@RequireModule('api_search_dni')` + `@RequireFeature('api.dni_search')`.
- **Guards extra**: `JwtAuthGuard`, `ApiQuotaGuard` (a nivel de clase).
- **Path params**:

  | Campo | Tipo | Requerido | Validación | Descripción |
  |-------|------|-----------|-----------|-------------|
  | `ruc` | string | sí | `DniService` valida 11 dígitos (`/^\d{11}$/`) | RUC a consultar. |

- **Query**: ninguno.
- **Body**: no aplica.
- **Respuesta** (`RucResponse`): `{ ruc, nombre, estado?, direccion?, telefono? }`. `nombre` se normaliza a `''` si falta.
- **Efectos secundarios**: `ApiQuotaGuard` consume 1 unidad de cuota de API (escribe `api_usage`, con las mismas excepciones que el endpoint de DNI). No escribe auditoría.
- **Errores**:
  - `400 BadRequestException('RUC debe tener 11 dígitos')` si el formato es inválido.
  - `404 NotFoundException('RUC no encontrado en SUNAT')` si el proveedor responde 404.
  - `400 BadRequestException('Error al consultar RUC: <status>')` para otros estados HTTP.
  - `400 BadRequestException('Tiempo de conexión agotado con SUNAT')` si el `fetch` se aborta (timeout 15 s).
  - `400 BadRequestException('Error al consultar RUC')` como error genérico.
  - Mismos errores de gating/cuota que el endpoint de DNI.

## Funciones del servicio (`DniService`)

Proveedor externo: RENIEC para DNI y SUNAT para RUC. URLs y credenciales por variables de entorno
(`ConfigService`):

| Variable | Valor por defecto | Uso |
|----------|-------------------|-----|
| `RENIEC_API_URL` | `https://api.reniec.cloud/dni` | Base para DNI. |
| `RENIEC_API_TOKEN` | `''` | Si no está vacío, se envía `Authorization: Bearer <token>`. |
| `SUNAT_API_URL` | `https://api.sunat.cloud/rucs` | Base para RUC (sin token). |

### `findByDni(dni)`
- **Qué hace**: valida que `dni` sea 8 dígitos; arma cabecera `Authorization` solo si hay token; hace `fetch` a `${RENIEC_API_URL}/${dni}` con `AbortController` (timeout 10 s). Mapea la respuesta a `DniResponse` normalizando campos faltantes a `''`.
- **Escribe en**: no escribe en base de datos.
- **Devuelve**: `Promise<DniResponse>`.
- **Lanza**: `BadRequestException` (formato inválido, 401, otros estados, timeout, error genérico) y `NotFoundException` (404 o respuesta vacía).

### `findByRuc(ruc)`
- **Qué hace**: valida que `ruc` sea 11 dígitos; hace `fetch` a `${SUNAT_API_URL}/${ruc}` con `AbortController` (timeout 15 s). Mapea a `RucResponse`.
- **Escribe en**: no escribe en base de datos.
- **Devuelve**: `Promise<RucResponse>`.
- **Lanza**: `BadRequestException` (formato inválido, otros estados, timeout, error genérico) y `NotFoundException` (404 o respuesta vacía).

## Observaciones
- Ambos endpoints usan proveedores externos (`api.reniec.cloud`, `api.sunat.cloud` por defecto). No se verificó en el código que esos proveedores/endpoints sigan activos ni el formato exacto de sus respuestas JSON más allá del casteo `as DniResponse`/`as RucResponse`.
- El gating de plan se compone de `PlanCapabilitiesGuard` (módulo/feature) y `ApiQuotaGuard` (cuota); los administradores globales (`SUPER_ADMIN`/`SUPPORT_ADMIN`) y usuarios sin `companyId` no consumen cuota. Ver [`plan-capabilities.md`](./plan-capabilities.md).
