# Módulo: Health (liveness / readiness)

## Propósito
Expone sondas de salud del servicio: `live` (el proceso está vivo), `ready` (dependencias listas para
recibir tráfico) y un estado completo. Todas las rutas son públicas, pensadas para plataformas de
despliegue (Render) y monitoreo.

## Archivos clave
- `backend/src/modules/health/health.controller.ts` — controller `health` (rutas `live`, `ready`, raíz).
- `backend/src/modules/health/health.service.ts` — `HealthService` (checks de base de datos, Redis y memoria).
- `backend/src/modules/health/health.module.ts` — importa `PrismaModule` y `CacheModule`; provee `HealthService`.

## Endpoints

Los tres endpoints son `@Public()` (no requieren JWT) y no tienen gating de plan.

### GET /api/health/live
- **Descripción**: liveness probe. Indica únicamente que el proceso está en ejecución; no consulta dependencias.
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params / Query / Body**: no aplica.
- **Respuesta**:
  ```json
  {
    "status": "ok",
    "timestamp": "<ISO-8601>",
    "service": "backend",
    "version": "<npm_package_version | 1.0.0>",
    "uptime": <segundos>
  }
  ```
- **Efectos secundarios**: ninguno.
- **Errores**: ninguno explícito.

### GET /api/health/ready
- **Descripción**: readiness probe. Verifica base de datos, Redis y memoria. `status` es `ok` solo si los tres checks resultan `ok`; si alguno no, `degraded`.
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params / Query / Body**: no aplica.
- **Respuesta**:
  ```json
  {
    "status": "ok | degraded",
    "timestamp": "<ISO-8601>",
    "service": "backend",
    "version": "<npm_package_version | 1.0.0>",
    "checks": {
      "database": { "status": "ok | error", "latency": <ms>, "error?": "<string>" },
      "redis":    { "status": "ok", "latency": <ms>, "error?": "<string>" },
      "memory":   { "status": "ok | warning", "used": <MB>, "total": <MB> },
      "uptime":   <segundos>
    }
  }
  ```
- **Efectos secundarios**: ejecuta `SELECT 1` contra la base de datos y `PING` a Redis (si hay `REDIS_URL`).
- **Errores**: ninguno explícito; los fallos se reflejan dentro de `checks` (no lanzan).

### GET /api/health
- **Descripción**: estado completo. Reutiliza el resultado de `checkReady` y devuelve una versión reducida de `checks` (sin campos `error`).
- **Auth**: público (`@Public()`).
- **Plan**: ninguno.
- **Guards extra**: ninguno.
- **Path params / Query / Body**: no aplica.
- **Respuesta**:
  ```json
  {
    "status": "ok | degraded",
    "timestamp": "<ISO-8601>",
    "version": "<npm_package_version | 1.0.0>",
    "checks": {
      "database": { "status": "...", "latency": <ms> },
      "redis":    { "status": "...", "latency": <ms> },
      "memory":   { "used": <MB>, "total": <MB> },
      "uptime":   <segundos>
    }
  }
  ```
  Nota: en `checkFull` no se incluye `service` ni los campos `error` de los checks.
- **Efectos secundarios**: los mismos que `checkReady` (consulta base de datos y Redis).
- **Errores**: ninguno explícito.

## Funciones del servicio (`HealthService`)

### `checkLive()`
- **Qué hace**: devuelve estado básico usando `process.uptime()` y `process.env.npm_package_version`.
- **Escribe en**: no escribe.
- **Devuelve**: `{ status: 'ok', timestamp, service: 'backend', version, uptime }`.
- **Lanza**: nada explícito.

### `checkReady()`
- **Qué hace**: ejecuta `checkDatabase`, `checkRedis` y `checkMemory`; calcula `status = 'ok'` solo si los tres son `ok`, si no `'degraded'`.
- **Escribe en**: no escribe.
- **Devuelve**: `{ status, timestamp, service, version, checks: { database, redis, memory, uptime } }`.
- **Lanza**: nada explícito (los errores se capturan dentro de cada check).

### `checkFull()`
- **Qué hace**: llama a `checkReady()` y reconstruye `checks` sin los campos `error`; omite `service`.
- **Escribe en**: no escribe.
- **Devuelve**: `{ status, timestamp, version, checks }`.
- **Lanza**: nada explícito.

### `checkDatabase()` (privada)
- **Qué hace**: mide latencia de `prisma.$queryRaw`SELECT 1``.
- **Devuelve**: `{ status: 'ok', latency }` o `{ status: 'error', latency, error: 'Database unavailable' }` (registra con `logger.error`).
- **Lanza**: no propaga (captura).

### `checkRedis()` (privada)
- **Qué hace**: si no hay `REDIS_URL` configurado, devuelve `{ status: 'ok', latency: 0 }` (Redis no es obligatorio). Si hay, mide `cache.ping()`.
- **Devuelve**: `{ status: 'ok', latency }` en éxito; ante error devuelve `{ status: 'ok', latency, error: 'Redis unavailable, using memory fallback' }` y registra con `logger.warn`.
- **Lanza**: no propaga (captura).
- **Nota**: el check de Redis siempre devuelve `status: 'ok'` porque existe fallback en memoria; el error queda informado en el campo `error` sin degradar el estado global.

### `checkMemory()` (privada)
- **Qué hace**: lee `process.memoryUsage()` y calcula MB usados/totales del heap.
- **Devuelve**: `{ status: 'ok' | 'warning', used, total }`; `warning` si `usedMB >= totalMB * 0.9`.
- **Lanza**: nada.

## Observaciones
- `version` proviene de `process.env.npm_package_version` con respaldo `'1.0.0'`; puede no reflejar la versión real en algunos entornos de despliegue (no verificado).
- El `allHealthy` exige que `database`, `redis` y `memory` sean exactamente `'ok'`; por eso un `memory: 'warning'` (uso de heap >= 90 %) hace que `status` global pase a `'degraded'`, aunque no haya caída real.
