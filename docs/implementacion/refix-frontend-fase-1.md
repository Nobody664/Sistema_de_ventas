# Refix frontend — Fase 1

Rama: `refix/frontend-fase-1`, creada desde `main` (`f00a49f`, cierre del backend).

Alcance: F-01, F-02, F-03 y F-04 del informe técnico frontend del 23 de octubre de 2026.

## F-01 — Dependencias

- `next` actualizado de `16.2.6` a `16.4.3` (última revisión 16.x disponible).
- `@next/bundle-analyzer` alineado a `^16.4.3`.
- `zod` actualizado de `^3.24.1` a `^4.6.7` por el aviso GHSA-mrhx-c7xc-m3w5. Se migraron los parámetros de error de Zod 4 (`required_error`/`invalid_type_error` → `error`) y `@hookform/resolvers` a `^5.9.2`, compatible con Zod 4.
- Herramientas de build y tipos (`typescript`, `postcss`, `autoprefixer`, `tailwindcss`, `tailwindcss-animate`, `@types/*`, `@next/bundle-analyzer`) se movieron a `devDependencies`. No se ejecuta `npm audit fix --force` ni se cambió Tailwind a la versión mayor 4.
- Se añadió `tsx` como dependencia de desarrollo y el script `npm test` con `node:test`.

Resultado:

- `npm audit --omit=dev`: **0 vulnerabilidades**.
- `npm audit` completo: **3 moderadas**, todas en la cadena de build de Tailwind 3 (`postcss-nested` → `postcss-selector-parser`). No son código alcanzable desde HTTP en producción y el propio informe desaconseja el salto mayor automático.
- El lockfile fue regenerado. SSR, rewrites, imágenes y build se verificaron con Next 16.4.3.

## F-02 — Contrato de sesión

- `lib/session-contract.ts` define un único esquema Zod para la sesión pública: `id`, `email`, `fullName`, `roles`, `companyId`, `companyStatus`, `planCode`, `subscriptionStatus` y `trialEndsAt`.
- El esquema acepta `id` y, como compatibilidad, reconstruye `id` desde `sub`. Rechaza sesiones sin ninguno de los dos, correos inválidos y roles que no sean arreglo.
- `getMe`, `login`, `register` y `updateProfile` validan la respuesta antes de devolverla. `getServerSession` valida `/auth/me` y descarta una sesión que no cumpla el contrato.
- El backend ya devolvía `id`, `planCode` y `subscriptionStatus` en `/auth/me` tras las fases backend; esta fase cierra el lado cliente y elimina los casts sin validación.
- `auth.store` ya no borra al usuario ante un error de red o 5xx: solo limpia la sesión ante 401. Así una caída transitoria no expulsa al usuario mientras otras llamadas siguen activas.

## F-03 — Caché separada por sesión

- `lib/query-scope.ts` incorpora el alcance de sesión (`empresa:usuario:roles ordenados`, o `anonymous`) al hash de todas las claves de TanStack Query mediante `queryKeyHashFn`. La misma clave (`products`, `sales`, etc.) deja de compartir entrada entre empresas o usuarios.
- `AuthHydrator` fija el alcance en el render, cancela consultas en vuelo, limpia el `QueryClient` y reinicia el store de notificaciones cuando cambia la identidad.
- `notifications-store` expone `reset()`, que desconecta el stream, cancela el temporizador de reconexión y vacía datos y contador.
- La limpieza se dispara también al cerrar sesión, porque el alcance pasa a `anonymous`.

## F-04 — Renovación de sesión

- `lib/api/client.ts` centraliza `apiFetch`: headers completos, `FormData`, cuerpos vacíos/204, timeout con `AbortController`, errores tipados (`ApiError` con estado, código y detalles) y mensajes de validación en arreglo.
- La renovación ante 401 sigue siendo de una sola ejecución por pestaña, usa Web Locks cuando está disponible y un timestamp en `localStorage` para que otras pestañas no roten el refresh token en paralelo.
- `getMe` pasa por `apiFetch`, por lo que la hidratación del cliente renueva la sesión ante 401.
- `proxy.ts` renueva antes de renderizar cuando falta el access token o está vencido (margen de 30 s): llama a `/auth/refresh` con la cookie, reenvía las cookies nuevas al navegador y al request SSR. Si no hay refresh válido, redirige a `/sign-in` limpiando ambas cookies.
- `lib/session.ts` reintenta `/auth/me` con el refresh token en SSR cuando el access token fue rechazado, usando el token nuevo solo para esa renderización.
- `lib/auth-token.ts` y `lib/auth-cookies.ts` aíslan la lectura de JWT y `Set-Cookie` para poder probarlas sin navegador.

## Verificación

Ejecutado desde `frontend`:

```text
npm run lint
npm test
npm run build
npm audit --omit=dev
node node_modules/prettier/bin/prettier.cjs --check <archivos modificados>
git diff --check
```

Resultado: **13 pruebas aprobadas**, 0 fallos. Se cubren contrato de sesión (`id`/`sub`, rechazos, alcance), JWT (base64url, expiración y margen), cookies, aislamiento real de dos alcances en un `QueryClient` y cambio de hash.

No se automatizó el recorrido completo en navegador (empresa A/cajero A → logout → empresa B/cajero B) ni la renovación con dos pestañas reales. El aislamiento se probó a nivel de `QueryClient` y la renovación a nivel de helpers; queda pendiente la verificación manual en navegador.

## Cierre

Fase 1 completada en commit local. No se hizo push.
