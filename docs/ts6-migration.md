# TypeScript 6 Migration — Backend

## Problema

Render falló al compilar con TypeScript 6 por dos errores de deprecación:

1. **TS5101** — `baseUrl` está deprecado, dejará de funcionar en TS 7.0
2. **TS5107** — `moduleResolution: "node"` (alias `node10`) está deprecado, dejará de funcionar en TS 7.0

## Cambios realizados

### `backend/tsconfig.json`

| Opción | Antes (TS 5.x) | Después (TS 6) | Motivo |
|--------|----------------|----------------|--------|
| `moduleResolution` | `"node"` | `"bundler"` | TS 6 permite `bundler` + `commonjs`. Es el reemplazo moderno de `node10`. |
| `baseUrl` | `"."` | **Eliminado** | Deprecado en TS 6, eliminado en TS 7. `paths` funciona sin `baseUrl` desde TS 4.1. |
| `paths` | `"@/*": ["src/*"]` | `"@/*": ["./src/*"]` | Ahora es relativo al tsconfig (no a `baseUrl`) |
| `types` | *(implícito: todo)* | `["node"]` | TS 6 cambió el default a `[]` — hay que declarar `@types/node` explícitamente |
| `allowSyntheticDefaultImports` | `true` | Eliminado | Redundante con `esModuleInterop: true` |

### `backend/package.json`

| Paquete | Antes | Después |
|---------|-------|---------|
| `typescript` | `^5.7.0` | `^6.0.0` |

### Sin cambios necesarios

- `backend/tsconfig.build.json` — hereda todo del principal
- `frontend/tsconfig.json` — ya usaba `moduleResolution: "bundler"`, sin `baseUrl`
- `render.yaml` — build command sigue siendo `npm install && npx prisma generate && npm run build`

## Detalle técnico

### `moduleResolution: "bundler"` + `module: "commonjs"`

En TypeScript 5.x, `moduleResolution: "bundler"` solo funcionaba con `module: "preserve"` o `"es2015"+`. **TypeScript 6.0 eliminó esta restricción**, permitiendo usar `bundler` con `commonjs`. Esto es clave para NestJS, que necesita emit CommonJS por los decoradores.

`bundler` replica el comportamiento permisivo de `node10` (imports sin extensión, paths, package.json `exports`), pero sin estar deprecado. Es el reemplazo oficial.

### `baseUrl` eliminado

- `paths` funciona sin `baseUrl` desde TypeScript 4.1
- Las rutas en `paths` ahora son relativas al archivo tsconfig
- `baseUrl` dejó de ser necesario y fue deprecado en TS 6.0

### `types: ["node"]`

- TS 6.0 cambió el default de `types` a `[]` (antes incluía automáticamente todos los `@types/*`)
- Sin `types: ["node"]`, las APIs de Node (`process`, `Buffer`, `setTimeout`, etc.) no se resuelven
- Las importaciones por nombre (`import * from 'fs'`) siguen funcionando

## Validación

| Comando | Estado |
|---------|--------|
| `npx tsc --version` | `6.0.3` |
| `npm run lint` (`tsc --noEmit`) | ✅ Sin errores |
| `npm run build` (`tsc && tsc-alias`) | ✅ Compila y resuelve paths `@/` |

El build output en `dist/main.js` confirma que `tsc-alias` convierte `@/module` → `./module` correctamente.
