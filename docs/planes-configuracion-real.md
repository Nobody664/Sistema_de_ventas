# Estructura real de planes configurada en el sistema

Este archivo documenta **exactamente** cómo están configurados los planes en la base de datos actual (valores reales).

## 1. Planes (tabla `plans`)

| Campo | FREE | STARTUP | GROWTH | SCALE |
|---|---|---|---|---|
| Código | FREE | START | GROWTH | SCALE |
| Nombre | Free | Startup | Growth | Scale |
| Precio mensual | S/ 0.00 | S/ 99.00 | S/ 199.00 | S/ 399.00 |
| Precio anual | S/ 0.00 | S/ 1090.00 | S/ 2300.00 | S/ 4700.00 |
| Ciclo facturación | MONTHLY | MONTHLY | MONTHLY | MONTHLY |
| Usuarios máx. | 1 | 3 | 10 | 999 (ilimitados prácticos) |
| Productos máx. | 50 | 500 | 5000 | 999999 (ilimitados prácticos) |
| Activo | true | true | true | true |

## 2. Características (`features`)

| Plan | Features |
|---|---|
| FREE | `["1 usuario","50 productos","1 sucursal","POS basico"]` |
| START | `["3 usuarios","500 productos","3 sucursales","POS completo","Reportes basicos"]` |
| GROWTH | `["10 usuarios","5000 productos","sucursales ilimitadas","POS completo","Reportes avanzados","API"]` |
| SCALE | `["Sucursales ilimitadas","API","Webhooks"]` |

## 3. Módulos y permisos (`modules`, `permissions`)

**Observación:** En el esquema actual de `plans`, los campos `modules` y `permissions` **existen** en el modelo Prisma, pero **NO hay valores configurados** en la base de datos para estos planes (son `null` / no definidos). 

Por tanto:
- No hay módulos habilitados por plan guardados en `plans.modules`
- No hay lista granular de permisos guardados en `plans.permissions`

El sistema utiliza otros mecanismos (roles, guards) para control de acceso. No existe una configuración por-plan de `modules`/`permissions` en la tabla `plans` tal como está hoy.

## 4. API / búsqueda por DNI (`api*`)

| Campo | FREE | START | GROWTH | SCALE |
|---|---|---|---|---|
| `apiEnabled` | false | false | true | true |
| `apiSearchDniEnabled` | false | false | false | false |
| `apiQuota` | 0 | 0 | 0 | 0 |

- Solo **GROWTH** y **SCALE** tienen `apiEnabled = true`
- **Ningún plan** tiene habilitada la búsqueda por DNI (`apiSearchDniEnabled = false` en todos)
- **Cuota API** = 0 para todos los planes (no hay límite de requests configurado)

## 5. Conteos reales del sistema

| Entidad | Cantidad |
|---|---|
| Empresas (`companies`) | 4 |
| Usuarios (`users`) | 6 |
| Roles (`roles`) | 4 |
| API Keys (`apiKey`) | 0 |
| Productos (`products`) | 7 |

## Notas

- El campo `description` existe: FREE="Plan gratuito con funciones basicas", START="Plan ideal para pequena empresas", GROWTH="Plan para empresas en crecimiento", SCALE="Plan enterprise para grandes empresas".
- `billingCycle` = `MONTHLY` para todos.
- `features` es el array JSON que se muestra en la UI (landing/precios).
- La tabla `permissions` **no existe** en el esquema actual (se confirmó vía `information_schema`). El control de permisos se maneja con `roles`/guards en backend.
- Los campos `apiSearchDniEnabled` y `apiQuota` están presentes en el modelo `Plan` pero **no están activos** (todos en 0/false).