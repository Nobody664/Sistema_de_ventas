# Documentación del Sistema (Referencia Técnica)

Este directorio contiene la documentación de referencia del sistema de ventas SaaS:
qué hace cada módulo, qué información recibe y envía cada endpoint/función, y qué
efectos secundarios produce (escrituras en BD, notificaciones, auditoría, cola).

El objetivo es **localizar rápido la lógica** para poder corregirla o modificarla.

> Esta carpeta es de referencia. No modifica el comportamiento del sistema.

## Cómo está organizada

| Documento | Contenido |
|-----------|-----------|
| [`arquitectura.md`](./arquitectura.md) | Stack, estructura de carpetas, arranque de la app, cadena de guards globales, autenticación, multi-tenant. |
| [`modelo-de-datos.md`](./modelo-de-datos.md) | Modelos Prisma, enums y relaciones (base de datos). |
| [`roles-permisos-planes.md`](./roles-permisos-planes.md) | Roles globales y de empresa, matriz de permisos, módulos/features por plan, cuotas. |
| [`convenciones-api.md`](./convenciones-api.md) | Prefijo, formato de errores, paginación, CSRF, throttling, cookies, gating. |
| [`backend/README.md`](./backend/README.md) | Índice de módulos backend (endpoint por endpoint). |
| [`frontend/README.md`](./frontend/README.md) | Índice de áreas del frontend (páginas, componentes, llamadas API). |

## Plantilla usada por módulo (backend)

Cada archivo de `backend/` describe:

1. **Propósito** del módulo.
2. **Archivos clave** (controller, service, DTOs, module).
3. **Endpoints**: método, ruta completa, rol/permiso, módulo/feature de plan requerido,
   path params, query, body (campo a campo), respuesta y efectos secundarios.
4. **Funciones del servicio**: firma, qué hace, a qué tablas escribe.

## Plantilla usada por área (frontend)

Cada archivo de `frontend/` describe:

1. **Rutas/páginas** y si son server/client components.
2. **Componentes** principales y su responsabilidad.
3. **Llamadas al backend** (función del cliente → endpoint).
4. **Estado** (stores Zustand) y **flujo de usuario**.

## Convenciones rápidas

- Prefijo global de API: `/api` (configurable con `API_PREFIX`).
- Todos los endpoints requieren JWT salvo los marcados `@Public()`.
- Los errores tienen forma `{ statusCode, message, error?, code?, path, timestamp }`.
- Las mutaciones (POST/PUT/PATCH/DELETE) requieren `Content-Type: application/json` (protección CSRF).
- Ruta del código backend: `backend/src/modules/<modulo>/`.
- Ruta del código frontend: `frontend/app/`, `frontend/components/`, `frontend/lib/`.

## Nota sobre "categorías"

No existe un módulo NestJS `categories`. Las categorías se gestionan desde el módulo
**products** (`backend/src/modules/products/`). Ver [`backend/products.md`](./backend/products.md).
