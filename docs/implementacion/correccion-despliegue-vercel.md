# Corrección de instalación del frontend en Vercel

## Diagnóstico

El log aportado en `docs/error-vercel.md`, correspondiente al commit `22bd7dd`, muestra que Vercel ejecutó `npm install` y eliminó dependencias de desarrollo antes de ejecutar `next build --webpack`.

La compilación falló por ausencia de `tailwindcss`. También aparecieron fallos de resolución de `@/components/...`: esos archivos existen en Git y el alias está declarado en `tsconfig.json`; TypeScript es otra dependencia de desarrollo necesaria para procesar esa configuración.

## Cambio

`frontend/vercel.json` fija `installCommand` a `npm ci --include=dev`. Así se usa el lockfile y se incluyen explícitamente las herramientas de compilación aunque el entorno configure `NODE_ENV=production` o la omisión de dependencias de desarrollo.

## Verificación local

- Instalación limpia con `NODE_ENV=production` y `npm_config_omit=dev`, ejecutando `npm ci --include=dev`.
- Resolución confirmada de Tailwind, TypeScript, PostCSS y Autoprefixer.
- `npm run lint`: correcto.
- `npm test`: 38 pruebas aprobadas.
- `node node_modules/next/dist/bin/next build --webpack`: compilación correcta de las 62 rutas.
- `npm run test:browser:refix`: cinco comprobaciones funcionales aprobadas sobre el build Webpack, con backend simulado.

Se ejecutó Next directamente para comprobar Webpack porque npm 11 en PowerShell interpretó `--webpack` como configuración de npm en lugar de reenviarlo al script.

La publicación en Vercel debe verificarse después del push mediante el estado del deployment y el documento de producción.
