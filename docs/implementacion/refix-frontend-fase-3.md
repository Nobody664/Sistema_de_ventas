# Refix frontend — Fase 3

Rama: `refix/frontend-fase-3`, creada desde `main` (`b9f2813`, cierre de la Fase 2).

Alcance: F-09, F-10, F-11 y F-12 del informe técnico frontend del 23 de octubre de 2026.

## F-09 — Fallos de carga y estados vacíos

- `lib/server-api-result.ts` devuelve un resultado discriminado con estado HTTP y clase de fallo: sesión ausente/expirada, sin permiso, no encontrado, HTTP, red o respuesta inválida. Usa un timeout de 20 segundos y no almacena las respuestas en caché.
- `serverApiFetch` traduce 401 a `/sign-in`, 403 a `/forbidden` y 404 a `notFound()`. Los errores HTTP restantes, red caída y JSON inválido lanzan `ServerApiError` y alcanzan el límite de errores con reintento. Solo un JSON `null` explícito o un 204 se conservan como ausencia válida.
- Se eliminaron los catches que convertían fallos SSR en `null` o arreglos vacíos en detalles/edición de ventas, productos, clientes, empleados, categorías, notas de crédito y perfil. Plataforma incorpora un límite de errores reutilizando el de dashboard.
- El editor de una plantilla existente consulta su ID directamente; una plantilla inexistente no abre un formulario de creación.
- El chat usa TanStack Query para el polling, conserva mensajes anteriores si falla la actualización y muestra el fallo de carga/sincronización con reintento. No presenta un error inicial como “No hay mensajes aún”.
- Crear una venta no consulta distribuidores para cajeros. El perfil de soporte tampoco consulta el listado de empresas reservado al superadministrador.

## F-10 — Capacidades efectivas

- `types/permissions.ts` centraliza las restricciones por rol de las acciones revisadas en `ACTION_ROLES` y las combina con permisos declarados mediante `hasEffectivePermission`.
- `usePermissions`, y por tanto `PermissionGuard` y `PageGuard`, usan esa evaluación. Se conserva el bypass de `SUPER_ADMIN` que también aplica `RolesGuard` en backend.
- Exportar ventas y editar clientes se muestran solo a roles autorizados; la edición de cliente también se comprueba antes de cargar la ruta SSR.
- La revisión de upgrades exige `platform:companies_manage`. Las consultas quedan deshabilitadas para soporte, y el menú no ofrece solicitudes ni empresas a ese rol.
- Los fallos de exportación de ventas se muestran con toast, incluido un resultado sin archivo. No se relajaron guards del backend.

## F-11 — Historial e indicadores de ventas

- El historial solicita páginas de 20 con `page` y `limit`, claves de consulta separadas y navegación anterior/siguiente. Se muestran todas las filas de la página, sin el recorte adicional a 15.
- `useSales` también admite página y límite explícitos.
- Los indicadores provienen de `/dashboard/tenant`, que agrega ventas completadas y conserva el alcance empresa/vendedor del backend. No se calculan desde la muestra del historial.
- Los rótulos distinguen hoy de los últimos 30 días y muestran el alcance. La caché de indicadores comparte el prefijo `sales` para invalidarse al registrar una venta.
- Si falla una actualización se conserva el dato previo con un estado visible y reintento. Un indicador sin datos no se sustituye por cero.
- La API de listado devuelve un arreglo sin total. Por ello el botón siguiente se habilita cuando llegan 20 filas; si el último bloque tiene exactamente 20, la siguiente página puede estar vacía y permite volver atrás. No se infiere un total global desde la longitud del arreglo.

## F-12 — Recuperación de notificaciones

- Se mantiene el backoff de reconexión de Fase 1 y se corrige la detección de 401/403 usando `ApiError.status`. Un rechazo de sesión/permisos detiene los reintentos.
- Al abrir o recuperar el stream se sincronizan la lista y el contador autoritativo. El contador no se deduce de una lista limitada.
- Las entregas SSE se deduplican por ID y un duplicado no produce otro sonido ni incremento. Una notificación leída no retrocede a no leída por una entrega antigua.
- Dos confirmaciones concurrentes de lectura descuentan una sola transición.
- El reset por sesión invalida respuestas HTTP en vuelo, además de cerrar stream y temporizador. Los callbacks de streams antiguos no repueblan la nueva sesión.

## Verificación

Desde `frontend`:

```text
npm run lint
npm test
npm run build
node node_modules/prettier/bin/prettier.cjs --check <archivos modificados>
git diff --check
```

Resultado: **33 pruebas aprobadas**, 0 fallos; build de **62 páginas**. Se añadieron casos para clasificación de errores HTTP/red/JSON, roles mixtos y permisos efectivos, deduplicación, lectura concurrente, respuesta de una sesión antigua, recuperación SSE con contador autoritativo y detención ante 403.

Pendiente de validación manual en navegador: API caída durante SSR/polling, recorrido con cajero/gerente/soporte, navegación de varias páginas reales y desconexión/reconexión SSE con cambio de cuenta.

## Cierre

Fase 3 completada en commit local.
