# Informe de revisión técnica y seguridad — Frontend

**Fecha:** 2026-10-23

**Rama y revisión:** `main`, `625b5d3d5cd9e338e3cd1084c19e758737b6eb10`.

**Tecnologías:** Next.js 16.2.6, React 19, Tailwind, Zustand y TanStack Query.

**Informe complementario:** [Backend](informe-revision-tecnica-backend-2026-10-23.md).

## 1. Dictamen ejecutivo

El frontend está organizado con App Router, separación de rutas de empresa/plataforma, cookies HttpOnly y comprobación de sesión desde el servidor. React escapa los textos habituales y el procesamiento de imágenes rechaza formatos no admitidos antes de enviarlos al backend.

Los principales problemas son **aislamiento de caché entre sesiones, contrato de sesión incorrecto, recuperación incompleta de sesiones caducadas y flujos que la interfaz ofrece pero la API no puede completar**. Además, la auditoría de dependencias reporta una entrada crítica en Next.js y otras alertas transitivas.

Ocultar botones no sustituye autorización de servidor. En varios casos el backend sí rechaza la operación, pero la interfaz muestra la acción o convierte el rechazo en un listado vacío. En otros casos, los problemas de negocio documentados en el informe backend siguen siendo alcanzables mediante peticiones directas aunque la pantalla no los anuncie.

## 2. Alcance y certeza
 
Se revisaron proxy, configuración de Next, sesión SSR, clientes HTTP, stores, providers, guards visuales, formularios principales, imágenes, impresión, notificaciones y las pantallas de plataforma. Se contrastaron payloads y expectativas con DTOs/rutas reales del backend.

- **Código:** comportamiento identificable directamente en los archivos.
- **Demostración local:** verificación de caché con TanStack Query y normalización de URL con datos sintéticos; validaciones del backend ejecutadas con mocks.
- **Dependencia:** aviso del registro npm, sin afirmar que todos sus prerrequisitos se dan en producción.
- **Pendiente E2E:** sesión de navegador, múltiples usuarios/empresas, accesibilidad visual y despliegue real.

No se realizó una prueba de penetración sobre Vercel/Render ni se modificaron registros de negocio. Las conclusiones corresponden al commit indicado. Esta es una revisión transversal; no una certificación visual o funcional de cada combinación de pantalla, rol, plan y estado.

## 3. Controles positivos

| Control                        | Evidencia y evaluación                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cookies de autenticación       | El backend crea cookies HttpOnly; `lib/api/auth.ts:132-134` no devuelve el access token a JavaScript. No se encontró almacenamiento de tokens de sesión en localStorage en el flujo revisado.     |
| Sesión de servidor             | `lib/session.ts:29-59` consulta `/auth/me` con Bearer y `cache: no-store`. El proxy no es la única capa de autenticación. Hay defectos de contrato y renovación detallados abajo.                 |
| Separación de plataforma       | `app/(platform)/layout.tsx` comprueba roles; páginas de finanzas y APIs realizan comprobaciones adicionales. El backend también tiene guards.                                                     |
| Datos dinámicos                | `lib/server-api.ts` usa `no-store`; no se identificó una caché pública deliberada de las respuestas privadas de la API. El riesgo F-03 es caché de cliente persistente durante la navegación SPA. |
| Texto de soporte y formularios | Renderizado normal con React, sin `dangerouslySetInnerHTML` en las superficies buscadas. Los mensajes se presentan como texto, no como instrucciones ejecutables.                                 |
| Imágenes                       | `lib/image-compression.ts:8-83`: PNG/JPEG/WebP, máximo 10 MB de entrada, reducción de tamaño, conversión con canvas y liberación de object URLs. El servidor vuelve a validar el contenido real.  |
| Impresión de compras           | `app/(dashboard)/inventory/entries/entries-client.tsx:257-309` escapa nombres, descripción y referencias antes de construir HTML.                                                                 |
| Cabeceras básicas              | `next.config.ts:70-79`: DENY para frames, `nosniff`, referrer policy; `poweredByHeader: false` y source maps de navegador desactivados.                                                           |
| Redirect de login              | Existe una función restrictiva básica, pero incompleta ante barras invertidas; ver F-13.                                                                                                          |

## 4. Hallazgos priorizados

| ID   | Severidad                            | Hallazgo                                                                                            | Certeza                                                            |
| ---- | ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| F-01 | Crítica en auditoría de dependencias | Next.js y dependencias transitivas con avisos publicados.                                           | Scanner; explotación concreta pendiente.                           |
| F-02 | Alta                                 | `/auth/me` no devuelve el modelo de sesión que frontend declara.                                    | Contrato confirmado con backend real/mocks.                        |
| F-03 | Alta                                 | Cachés y stores no están aislados ni limpiados al cambiar de sesión.                                | Código + demostración de caché.                                    |
| F-04 | Media                                | Caducidad del access token no se recupera adecuadamente en SSR/hidratación.                         | Código.                                                            |
| F-05 | Media                                | Logout puede aparentar éxito aunque la sesión siga activa en las cookies.                           | Código.                                                            |
| F-06 | Alta                                 | Cambio de plan: IDs CUID son rechazados por pipes UUID del backend.                                 | Contraste de modelo/rutas + demostración.                          |
| F-07 | Alta                                 | Alta de plantillas no satisface los campos requeridos y default esperado.                           | Contraste de formulario/servicio/esquema.                          |
| F-08 | Alta / compartida                    | Presentaciones y venta a distribuidor no comparten contrato de precio/cantidad.                     | Código + rechazo de DTO demostrado.                                |
| F-09 | Media                                | Errores SSR se convierten en ausencia de registros o 404.                                           | Código.                                                            |
| F-10 | Media                                | Permisos visibles y acciones ofrecidas no coinciden con la API.                                     | Código.                                                            |
| F-11 | Media                                | Listas limitadas se presentan como métricas/historial completos.                                    | Código.                                                            |
| F-12 | Media                                | SSE no se recupera después del primer fallo y el contador puede divergir.                           | Código.                                                            |
| F-13 | Media                                | Redirect de login no valida el origen después de normalizar la URL.                                 | Predicado actual + normalización demostrados; navegador pendiente. |
| F-14 | Mejora de seguridad                  | Falta CSP del frontend y sandbox de impresión.                                                      | Configuración; no XSS explotado.                                   |
| F-15 | Media                                | Fechas de formularios pueden cambiar de día al interpretarse en Lima.                               | Código y semántica estándar de Date.                               |
| F-16 | Baja / funcional                     | Primitivas de diálogo descartan className; exportación depende de hover y hay estilos no adaptados. | Código; revisión visual pendiente.                                 |

### F-01. Dependencias con alertas públicas

**Referencias:** `package.json:32`, `package-lock.json`, `next.config.ts:83-85`.

Se ejecutó `npm audit --omit=dev --json` en `frontend`. El registro devolvió **10 entradas: 1 crítica, 8 altas y 1 moderada**. Son entradas de paquetes y dependencias relacionadas, no diez ataques demostrados.

| Componente                                                     | Resultado relevante                                                                                                                                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next` 16.2.6                                                  | Entrada crítica. El registro consultado propone 16.4.2 como actualización no mayor. Hay avisos sobre proxy/middleware, cache, Server Actions y optimización de imágenes, con requisitos distintos. |
| `sharp` transitivo                                             | Entrada alta en la cadena de Next, distinta de la versión directa de Sharp del backend.                                                                                                            |
| `postcss`, `source-map-js`, `postcss-selector-parser`          | Avisos de procesamiento/parseo; distinguir build de código alcanzable desde HTTP.                                                                                                                  |
| `tailwindcss`, `chokidar`, `fast-glob`, `micromatch`, `braces` | Avisos de expansión/recursión y DoS, en buena parte asociados al procesamiento de archivos. El scanner puede proponer un cambio mayor de Tailwind; no hacerlo automáticamente.                     |

Referencias de advisories destacados:

- [GHSA-6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24): bypass de Middleware/Proxy bajo condiciones específicas de App Router/Turbopack/locales.
- [GHSA-p9j2-gv94-2wf4](https://github.com/advisories/GHSA-p9j2-gv94-2wf4): SSRF en rewrites bajo condiciones del advisory.
- [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw): ejecución remota en optimización de SVG bajo las condiciones del advisory.

**Evaluación:** no se probó RCE, SSRF ni bypass de sesión en producción. Next tiene una superficie de imágenes propia, aun cuando los uploads del backend se validen correctamente. La configuración admite formatos optimizados AVIF/WebP; eso no demuestra por sí solo una explotación, pero exige revisar los avisos del optimizador y actualizar.

**Acción:** actualizar a una versión corregida y compatible, revisar también el bundle analyzer, regenerar lockfile y probar SSR, imágenes y rewrites. No se ejecutó `npm audit fix` ni se modificaron dependencias en esta revisión.

### F-02. Contrato de sesión `sub` frente a `id`

**Referencias frontend:** `lib/session.ts:8-24,39-55`; `lib/api/auth.ts:15-30,96-101`; `stores/auth.store.ts:111-135`; `app/(platform)/platform/support/page.tsx:15-27`.

**Referencias backend:** `backend/src/modules/auth/auth.controller.ts:90-94`; `backend/src/modules/auth/auth.service.ts:527-536`; `backend/src/modules/auth/jwt.strategy.ts:45-67`.

Login devuelve `user.id`, pero `/auth/me` devuelve directamente los claims con `sub`, no `id`. El JWT tampoco incluye `planCode` ni `subscriptionStatus`, que sí aparecen en la respuesta inicial de login. Los clientes hacen cast al tipo esperado sin transformar ni validar.

**Consecuencias:** después de hidratar o recargar, `user.id` puede ser `undefined`; el marcado de agente “yo” de soporte y otros consumidores de identidad no son fiables. Los metadatos de plan/suscripción pueden desaparecer entre login y recarga. No se afirma que esto permita suplantar al usuario del backend: este sigue utilizando `sub`.

**Demostración:** `AuthController.me` con claims sintéticos devolvió `sub` y no devolvió `id`.

**Corrección:** DTO público único de sesión, reconstruido por `/auth/me`, y validación de respuesta con Zod u otro esquema. No resolverlo únicamente con una aserción TypeScript.

### F-03. Caché no separada por empresa/usuario

**Referencias:** `app/providers.tsx:8-18`; `hooks/useData.ts:8-14,23-60`; `components/layout/app-header.tsx:54-57`; `stores/auth.store.ts:90-103`; `store/notifications-store.ts:130-144`.

El QueryClient vive en el provider raíz y las claves son genéricas: `products`, `customers`, `sales`, etc. No incluyen tenant ni usuario, aun cuando la visibilidad de ventas ahora depende del vendedor. Logout solo limpia el store de auth; no borra TanStack Query ni el contenido/contador del store de notificaciones.

**Impacto:** al cambiar de usuario en el mismo navegador y mantener la navegación SPA, puede reutilizarse información de la sesión anterior durante el staleTime. No necesita que el backend permita una consulta cruzada: el dato ya estaba en memoria del navegador.

**Demostración local:** se guardó una respuesta sintética de empresa A en `['products']`; una consulta con la misma clave y staleTime de cinco minutos, cuyo fetch representaba empresa B, devolvió la respuesta de A. El recorrido completo logout/login no se automatizó en navegador, pero el mecanismo de reutilización está demostrado.

**Corrección:** claves por tenant y usuario/rol según el recurso, cancelar peticiones pendientes y limpiar cachés/stores al cerrar o cambiar sesión. Prueba obligatoria: empresa A/cajero A → logout → empresa B/cajero B, sin recargar toda la pestaña.

### F-04. Renovación incompleta de sesión

**Referencias:** `lib/session.ts:29-58`; `components/auth/auth-hydrator.tsx:8-11`; `lib/api/auth.ts:96-101`; `stores/auth.store.ts:111-135`; `lib/api.ts:15-30,75-94`.

`apiFetch` renueva ante 401 de rutas no-auth, pero `getMe` e hidratación usan fetch directo y no intentan renovar. SSR requiere access token presente y devuelve sesión nula si `/auth/me` responde 401. No existe un puente completo para recuperar la sesión con refresh cookie y volver a emitir cookies desde un contexto autorizado de Next.

**Resultado:** un refresh token todavía válido no garantiza continuidad al abrir una ruta SSR o recargar tras caducar el access token. Puede redirigirse a login o vaciarse el store de auth mientras otras llamadas llegan a renovar la cookie.

**Corrección:** diseñar un único flujo de refresh con route handler/puente de cookies y contrato compartido; sincronizar el estado del store cuando cambie la sesión. Evitar renovaciones concurrentes entre pestañas, ya que el backend también tiene la carrera B-05.

### F-05. Logout con éxito aparente

**Referencias:** `lib/api/auth.ts:88-94`; `stores/auth.store.ts:90-103`; `components/layout/app-header.tsx:54-57`.

La función de logout no comprueba `response.ok`. El store ignora errores y siempre se declara desautenticado. Si el servidor no borró las cookies por fallo HTTP/red, la UI navega a login, pero una recarga puede recuperar una sesión que el usuario cree cerrada.

**Corrección:** confirmar el resultado del servidor, cerrar streams, cancelar solicitudes y limpiar caché/estado en el mismo proceso. Si no puede confirmarse la revocación, informarlo y evitar representar un cierre definitivo. Añadir prueba con respuesta 500 y desconexión de red.

### F-06. Upgrade bloqueado por el formato del ID

**Referencias:** `components/subscriptions/upgrade-plan-modal.tsx`; `app/(platform)/platform/upgrade-requests/page.tsx:178-182,216-220`; `backend/prisma/schema.prisma:831-856`; `backend/src/modules/subscriptions/plan-upgrade-requests.controller.ts:44,80`; `backend/src/modules/platform/platform-upgrade-requests.controller.ts:42`.

Las solicitudes tienen ID `cuid()` en Prisma. Los endpoints de subida/revisión de upgrades usan `ParseUUIDPipe`. La UI recibe un ID válido creado por el sistema, pero al enviarlo obtiene 400 antes de llegar al servicio.

**Demostración:** el pipe real rechazó un valor de formato CUID. La contradicción del generador con el pipe está directamente en el código.

**Corrección:** uniformar el contrato de identificadores, validar CUID/string según el modelo o migrar de manera explícita a UUID. Añadir E2E de crear solicitud → subir imagen válida → revisar → activar plan.

### F-07. Alta/default de plantillas incompletos

**Referencias:** `app/(platform)/platform/templates/template-editor.tsx:117-155`; `backend/src/modules/invoices/invoices.service.ts:61-115`; `backend/prisma/schema.prisma:859-895`; `backend/src/modules/invoices/invoices.controller.ts:23-61`.

El modelo exige `InvoiceTemplate.content`, pero el servicio de creación no lo envía. El formulario es de configuración de campos, no de ese contenido requerido, y el payload no soluciona el desacuerdo. El uso de `any` en el servicio evita que TypeScript detecte este error.

Además, si se solicita default, el servicio desmarca las otras plantillas pero no asigna `isDefault` a la nueva. Un SUPER_ADMIN sin tenant también encuentra el obstáculo de TenantGuard aunque la pantalla sea global de plataforma.

**Demostración de payload:** con el servicio real y repositorio simulado, el alta no incluyó `content` ni `isDefault: true`. La obligatoriedad de `content` está en el esquema; no se hizo una escritura contra la BD para provocar el fallo.

**Corrección:** decidir si `content` sigue siendo requerido, alinear modelo/DTO/formulario, guardar default de forma transaccional y separar las rutas globales del guard de tenant.

### F-08. Venta por presentación y a distribuidor

**Referencias:** `components/sales/sale-form.tsx:208-250,316-354`; `backend/src/modules/sales/sales.service.ts:325-340`; `backend/src/modules/distributors/dto/distributor.dto.ts` (`DistributorSaleItemDto`, `RegisterDistributorSaleDto`).

1. El frontend calcula precio base por factor si una presentación no tiene precio propio, mientras el backend POS utiliza solo el precio base: el total visto puede no ser el cobrado.
2. El payload de ventas a distribuidor reusa `presentationId`; el DTO de ese endpoint no lo permite. Con la validación estricta, seleccionar presentación produce un rechazo.
3. El formulario limita cantidades a enteros desde uno, mientras los DTOs POS permiten milésimas. No permite vender ciertos productos por peso/fracción aunque el backend lo soporte.
4. La selección de productos para distribuidor depende del stock central, no del detalle de stock consignado; el flujo no representa consistentemente la disponibilidad por canal.

**Demostración:** `RegisterDistributorSaleDto` rechazó una línea con `presentationId` bajo whitelist estricto.

**Corrección:** contrato de unidades/precios por canal, cálculo autoritativo o cotización de servidor, reglas de precisión por unidad de medida y conciliación del total confirmado. No mostrar éxito basándose solo en el total calculado por el navegador.

### F-09. Un error se muestra como “no hay datos” o como 404

**Referencias:** `lib/server-api.ts:5-26`; `app/(dashboard)/sales/page.tsx:10-12`; `app/(dashboard)/employees/page.tsx:40-43`; `app/(dashboard)/support/chat/[id]/page.tsx:18-24`; `components/support/support-chat-view.tsx:22-33`.

`serverApiFetch` retorna `null` ante 401, 403, 500, error de red o JSON inválido. Muchas páginas convierten ese valor a `[]`, cero o `notFound()`. El polling de chat ignora los errores y presenta “No hay mensajes aún” también si falló la carga inicial.

**Impacto:** un usuario sin permiso ve una tabla vacía; una caída de API se interpreta como eliminación de datos; soporte puede parecer sin actividad cuando está desconectado.

**Corrección:** resultado tipado con estado HTTP y clase de error; distinguir vacío, sin permiso, no encontrado, sesión expirada y dependencia caída. Añadir retry explícito y estados visibles de sincronización.

### F-10. Acciones visibles que la API no autoriza

**Referencias:** `app/(dashboard)/sales/sales-client.tsx:76-95,203-227`; `backend/src/modules/sales/sales.controller.ts:32-44`; `app/(platform)/platform/upgrade-requests/page.tsx:115-159,258-260`; `backend/src/modules/platform/platform-upgrade-requests.controller.ts:33-44`; `components/auth/page-guard.tsx`.

- Ventas muestra exportación a cajeros; el backend la restringe a COMPANY_ADMIN/MANAGER. El catch de exportación solo escribe en consola.
- La pantalla de solicitudes admite SUPPORT_ADMIN, pero listar/revisar upgrades exige `PLATFORM_MANAGE_COMPANIES`, que ese rol no tiene.
- Hay diferencias entre permisos declarados y roles permitidos: por ejemplo, el sistema concede algunos permisos de clientes al cajero mientras ciertos endpoints de actualización exigen además otro rol.

**Corrección:** una matriz única de acciones y capacidades; ocultar/deshabilitar según permisos efectivos y mostrar un error útil si el backend rechaza. Mantener la autorización del servidor: estos desacuerdos no se resuelven relajando guards indiscriminadamente.

### F-11. Historial y métricas calculados desde muestras

**Referencias:** `app/(dashboard)/sales/page.tsx`; `app/(dashboard)/sales/sales-client.tsx:34-56,239`; `hooks/useData.ts:55-60`; `backend/src/modules/sales/sales.service.ts:92-120`.

Ventas obtiene la primera página de 20, calcula “ventas hoy” e ingresos desde ese arreglo y muestra solo 15. No hay navegación de páginas en esa pantalla. Con más ventas, los indicadores y el historial visible no representan el total del día.

Otros listados muestran conteos basados en su longitud paginada o limitada. Los gráficos pueden mostrar una ausencia de datos causada por F-09.

**Corrección:** métricas agregadas de servidor, paginación/cursor visible y rotulado de “últimas N”. Las métricas personales de cajero deben seguir el mismo alcance que la consulta autorizada.

### F-12. Recuperación de notificaciones

**Referencias:** `store/notifications-store.ts:62-78,98-144`; `components/layout/notification-bell.tsx:38-68`.

`EventSource.onerror` cierra el stream y elimina la referencia, anulando su reconexión automática. El polling de la campana refresca el contador, no vuelve a conectar el stream. Se pierden entrega en tiempo real y sonido hasta que otro ciclo de montaje/conexión lo reactive.

Además, `markAsRead` resta uno aunque el elemento ya estuviera leído y `addNotification` no elimina duplicados antes de incrementar. El store no se reinicia al cambiar de cuenta, como se señala en F-03.

**Corrección:** backoff y reconexión con sesión válida, deduplicación por ID, transición de lectura condicionada al estado y limpieza completa de suscriptor/datos por sesión.

### F-13. Redirección con barra invertida

**Referencia:** `components/auth/sign-in-form.tsx:20-25,44-51`.

El filtro comprueba que el texto empiece por `/` y no por `//`, pero acepta una barra seguida de barra invertida. El parser estándar de URL puede normalizar esa entrada como una autoridad externa.

**Demostración:** la cadena sintética formada por `/` + carácter de barra invertida + `example.invalid/path` supera las comprobaciones actuales; `new URL(valor, 'https://app.example.invalid')` produce origen `https://example.invalid`.

**Certeza:** la validación incompleta está demostrada. No se automatizó `router.replace` en navegador para afirmar un recorrido de phishing explotado.

**Corrección:** normalizar primero, comparar origen permitido y devolver solo pathname/search/hash internos; rechazar barras invertidas, controles y esquemas externos. Probar también variantes codificadas y rutas de login para evitar bucles.

### F-14. CSP y contexto de impresión

**Referencias:** `next.config.ts:70-79`; `app/(dashboard)/sales/[id]/sale-detail-client.tsx:43-64`; `app/(dashboard)/inventory/entries/entries-client.tsx:301-312`.

No se configura CSP para la aplicación Next en este archivo. Helmet del backend no protege automáticamente los documentos HTML del frontend. La impresión de venta usa un iframe `srcdoc` sin sandbox; la impresión de compras abre una ventana con acceso al opener.

**Evaluación:** las boletas actuales escapan los valores habituales y se validan las imágenes; **no se confirmó un XSS almacenado en esos flujos**. La falta de aislamiento aumenta el impacto de una futura regresión de escape o de HTML heredado no validado.

**Mejora:** CSP compatible con Next, contexto de impresión aislado con las capacidades mínimas necesarias y política explícita de recursos. No implementar una sanitización que rompa la impresión sin pruebas funcionales.

### F-15. Fecha de movimiento desplazada por zona horaria

**Referencias:** `components/platform/platform-finance-client.tsx:96-118` y renderizado de `occurredAt`; `components/platform/platform-api-usage-client.tsx`, formulario de registro de consumo.

El valor de `<input type="date">` se convierte con `new Date('YYYY-MM-DD').toISOString()`, es decir, medianoche UTC. Al presentarlo con la zona del navegador en Lima puede verse el día anterior. Por ejemplo, el inicio UTC del 23 corresponde a la tarde del 22 en Lima.

**Corrección:** decidir si el dato es fecha de negocio o instante. Para fecha pura, conservar el día sin conversión UTC; para instante, combinar hora y zona explícitas y mostrar la misma zona en reportes. Los períodos UTC de API deben distinguirse de los días contables de la empresa.

### F-16. UI, accesibilidad y props de componentes

**Referencias:** `components/ui/dialog.tsx:15-20,27-33,45-87`; `app/(dashboard)/sales/sales-client.tsx:203-227`; `components/notifications/notifications-client.tsx`.

- Las primitivas de diálogo extraen `className` pero no lo combinan con la clase interna; los tamaños/estilos pedidos por el llamador pueden ignorarse.
- El menú de exportación depende de `group-hover`, sin un patrón de menú accesible completo para teclado/táctil.
- Varias pantallas antiguas y las de solicitudes usan `bg-white`, `text-slate-900` y colores fijos que no siguen el tema oscuro.
- Polling de soporte cambia contenido en regiones vivas y algunas acciones pueden limpiar borradores al completarse una respuesta mientras el usuario continúa escribiendo. Requiere prueba de interacción y lectores de pantalla.

**Corrección:** composición de clases con `cn`, menús con foco/teclado, tokens de tema y control explícito del borrador enviado. La severidad visual exacta requiere recorrido de navegador, no se inferirá solo desde clases.

## 5. `null`, contratos y respuestas HTTP

| Dato/situación                                                                    | Evaluación                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user.id` tras `/auth/me`                                                         | Error de contrato confirmado, no un `null` legítimo. Ver F-02.                                                                                                                                                   |
| `fullName`, cliente, vendedor histórico, categoría, costo o expiración opcionales | Pueden ser ausencias legítimas. Mantener fallback visible; no inventar un vendedor ni asumir que costo desconocido equivale siempre a cero contable.                                                             |
| Fechas tipadas `Date` en `types/generated.ts`                                     | HTTP JSON entrega strings; algunas vistas convierten correctamente, pero las aserciones no garantizan forma/validez. Separar tipos de persistencia de contratos API.                                             |
| Decimal                                                                           | Parte del backend devuelve strings de Decimal y parte números serializados. El código suele utilizar `Number`, pero debe haber un DTO consistente y formato que no transforme inválidos silenciosamente en cero. |
| 401/403/404/5xx                                                                   | `serverApiFetch` no los diferencia. Ver F-09.                                                                                                                                                                    |
| Validación con array de mensajes                                                  | `apiFetch` construye `Error` a partir de `error.message`, que puede ser arreglo; se pierde estructura y contexto de campos.                                                                                      |
| 204 o cuerpo vacío                                                                | `apiFetch` siempre ejecuta `response.json()`. Es una fragilidad del wrapper; no se confirmó aquí un endpoint actual que devuelva 204 y provoque ese error.                                                       |
| Cabeceras personalizadas                                                          | `apiFetch` reconstruye headers y conserva solo Authorization explícita, descartando otras. No debe asumirse que una futura cabecera de idempotencia o correlación llegue al backend.                             |
| Errores de red prolongados                                                        | Los fetch centrales no fijan timeout con AbortController. Los procesos con `loading`/`finally` solo recuperan estado cuando la promesa termina.                                                                  |

**Recomendación transversal:** esquemas de respuesta en tiempo de ejecución y un resultado HTTP tipado, con estados de interfaz diferenciados y un contrato de errores coordinado con B-21.

## 6. Permisos, URLs e inyecciones

### Qué protege realmente el proxy

`proxy.ts:18-48` decodifica claims sin verificar firma ni expiración. Esa lectura puede orientar redirecciones, **pero no es una autorización criptográfica**. Los layouts consultan `/auth/me` y el backend valida el JWT; por eso no se afirma que falsificar la cookie baste para acceder a los datos.

La decisión de empresa suspendida/vencida puede quedar obsoleta porque el proxy usa el estado del token. La UI y el backend deben distinguir acceso comercial normal de rutas de recuperación de cuenta/pago. Probar las transiciones ACTIVE → PAST_DUE/SUSPENDED sin forzar un nuevo login.

### SQL injection y HTML

El frontend no debe sanear una consulta SQL para autorizarla: el servidor debe usar DTOs, filtros de alcance y parámetros. En las rutas inspeccionadas se envía JSON a servicios Prisma; no se encontró una consola SQL de usuario.

La representación normal de texto con React es positiva. Los puntos de HTML crudo localizados son impresión con `srcdoc`/`document.write`; actualmente se observó escape de los textos principales. El contenido que diga “ignora instrucciones” sigue siendo texto si no se ejecuta ni se envía a un agente con herramientas. Una URL con `.jpg` no debe tratarse como una imagen verificada: el backend actual ya la rechaza.

### Imágenes del navegador frente a servidor

La validación de `File.type`, extensión o `accept` es solo UX. La seguridad importante está en la decodificación del backend. Las imágenes deben pasar por ese flujo incluso cuando se edite una URL de producto/QR/logo. También hay que revisar recursos históricos almacenados antes de esas validaciones y actualizar Next/Sharp según F-01.

## 7. Cobertura funcional por área

| Área                                        | Estado revisado y puntos de atención                                                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login, registro, perfil, reset y logout     | F-02/F-04/F-05/F-13; formularios y respuestas no comparten siempre el mismo contrato. Recuperación/reset no equivalen a revocar inmediatamente todos los access tokens del backend.                                                                                |
| Layout de empresa/plataforma y navegación   | Hay separación de roles; no sustituye API. Proxy/SSR pueden divergir en estado de cuenta.                                                                                                                                                                          |
| Productos, categorías, clientes y empleados | Formularios y listas con datos de servidor; F-03/F-09/F-10. Cambiar el rol visual del empleado no garantiza cambiar el rol de la membresía en backend.                                                                                                             |
| Ventas, boletas y exportación               | F-08/F-10/F-11; alinear precios, unidades, visibilidad del cajero y documentos.                                                                                                                                                                                    |
| Inventario, entradas, lotes y sucursales    | Impresión de compras con escape; la UI no puede asegurar atomicidad de recepción o inventario. Probar cambios simultáneos y stock real después de reintentos.                                                                                                      |
| Distribuidores y compras/proveedores        | F-08; recepción puede mostrar éxito de una parte del proceso mientras otra falla en backend. Validar cantidades y detalle de productos por canal.                                                                                                                  |
| Suscripciones, checkout, pagos y plantillas | F-06/F-07 y problemas B-01/B-02/B-11/B-16. Un comprobante visual válido no prueba cobro real.                                                                                                                                                                      |
| Reportes y finanzas                         | F-09/F-11/F-15. Mostrar errores, rango, moneda y alcance; no presentar muestras como contabilidad completa.                                                                                                                                                        |
| Soporte y notificaciones                    | F-02/F-03/F-09/F-12. Consultas de chat sin paginación del lado servidor; la bandeja no debe perder reconexión ni datos de borrador.                                                                                                                                |
| Nuevas pantallas de plataforma              | Los guards específicos de finanzas/APIs son positivos. Contabilizar tokens crea egresos, no emite facturas tributarias ni factura automáticamente a empresas. Los estados contables avanzados e instrumentación externa siguen siendo alcance pendiente declarado. |
| UI compartida                               | F-16; revisar foco, errores, estados de espera, contraste y móvil con sesiones reales.                                                                                                                                                                             |

## 8. Verificaciones ejecutadas y limitaciones

| Verificación                                             | Resultado                                                                                                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint` frontend                                  | Aprobado en ejecución individual con timeout ampliado.                                                                                                                                               |
| Primera ejecución simultánea con lint/pruebas de backend | Timeout a 300 s; no se interpreta como error de TypeScript. El reintento individual aprobó.                                                                                                          |
| TanStack Query con datos sintéticos                      | La clave genérica fresca devolvió información de la sesión sintética anterior.                                                                                                                       |
| Normalización de redirect                                | El valor con barra invertida superó el filtro de prefijos y cambió de origen al normalizarse.                                                                                                        |
| Contrato `/auth/me`                                      | Se comprobó la ausencia de `id` en la salida de claims.                                                                                                                                              |
| IDs de upgrade y payload de distribuidor                 | Rechazo por ParseUUIDPipe y por el DTO estricto, respectivamente, usando la validación real del backend.                                                                                             |
| Payload de creación de plantilla                         | No contiene `content` ni el `isDefault` solicitado; sin escritura real.                                                                                                                              |
| `npm audit --omit=dev --json`                            | 10 entradas, con los matices de F-01.                                                                                                                                                                |
| Tests automáticos frontend                               | No hay script de pruebas en `frontend/package.json`; no se localizaron tests `spec/test` de componentes en `frontend/components`. TypeScript y build no prueban interacción ni aislamiento de caché. |
| Navegador/E2E, móvil, accesibilidad y proveedor de pago  | Pendientes: no se ejecutaron sesiones de navegador ni pagos reales.                                                                                                                                  |

El build de producción previo sobre este mismo commit estaba aprobado. No se volvió a ejecutar durante esta revisión documental; las verificaciones nuevas de esta sección no deben confundirse con una prueba E2E completa.

## 9. Plan de acción propuesto

### P0 — Confidencialidad y operaciones críticas

1. Evaluar/actualizar Next y las dependencias con alertas alcanzables.
2. Unificar `/auth/me` y la sesión tipada; comprobar respuestas en tiempo de ejecución.
3. Aislar y limpiar QueryClient/stores/streams por usuario y empresa.
4. Corregir junto al backend autoconfirmación de pagos, webhook y administración de FAQs globales.

### P1 — Procesos completos

1. Reparar el circuito de upgrade CUID → comprobante → revisión y su ciclo anual.
2. Completar alta y default de plantillas.
3. Unificar precios/unidades de ventas y distribuidor con servidor.
4. Diferenciar error/vacío/no autorizado y recuperar sesión caducada correctamente.
5. Agregar navegación de páginas y métricas agregadas reales.

### P2 — Robustez y experiencia

1. Reconexión y deduplicación de SSE, timeout/cancelación y gestión de borradores.
2. Redirecciones normalizadas y CSP/impresión aislada.
3. Fechas de negocio coherentes con zona horaria.
4. Props de diálogo, menú accesible, tema oscuro y recorridos móviles.

### Pruebas de aceptación mínimas

- Dos empresas y dos cajeros, con logout/login sin recargar, verificando que no reaparezcan datos de la cuenta anterior.
- Access token expirado con refresh vigente; backend caído; logout con 500; permisos modificados durante la sesión.
- Intentos de acceder directamente a páginas/acciones ocultas y verificación de que el backend responda 401/403/404 correctamente.
- Imagen válida, imagen falsificada, URL con extensión de imagen, SVG, Base64 corrupto y archivo concatenado.
- Venta por presentación sin precio propio, cantidad fraccionaria, distribuidor y stock modificado en paralelo.
- Upgrade con ID recién creado, aprobación anual, alta de plantilla y cambio de default.
- SSE interrumpido, polling fallido, doble envío/reintento, fecha en Lima y ausencia de recursos opcionales.

## 10. Resultado de esta entrega

Se entrega este archivo junto al informe de backend. No se modificaron componentes, dependencias ni lógica de aplicación para redactarlos. Los hallazgos quedan documentados para una fase de corrección y verificación posterior.
