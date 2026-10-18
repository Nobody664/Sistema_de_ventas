# Frontend — Índice de Áreas

Cada archivo documenta un área del frontend Next.js: rutas/páginas, componentes
responsables, llamadas al backend y estado global. Ruta del código: `frontend/`.

| Área | Documento | Contenido |
|------|-----------|-----------|
| Autenticación y sesión | [auth-y-sesion.md](./auth-y-sesion.md) | sign-in/up, forgot/reset, guards, store de sesión, checkout, páginas públicas de estado. |
| Layout, navegación y estado | [layout-navegacion-estado.md](./layout-navegacion-estado.md) | sidebars, header, banners, stores (`ui-store`, `notifications-store`). |
| Dashboard | [dashboard.md](./dashboard.md) | Panel principal y gráficos. |
| Productos y categorías | [productos-categorias.md](./productos-categorias.md) | CRUD de productos/categorías, escáner, imágenes. |
| Ventas (POS) | [ventas.md](./ventas.md) | Punto de venta, detalle de venta, exportación, impresión. |
| Cupones de descuento | [discounts.md](./discounts.md) | CRUD de cupones con cupo/vigencia y consumo en el POS. |
| Finanzas | [finanzas.md](./finanzas.md) | Entradas/salidas, resumen, totales semanales y pagos de sueldo (solo `COMPANY_ADMIN`). |
| Clientes | [clientes.md](./clientes.md) | Listado, formularios y detalle de clientes. |
| Empleados | [empleados.md](./empleados.md) | Listado, formularios y detalle de empleados. |
| Inventario | [inventario.md](./inventario.md) | Movimientos, sucursales, entradas, lotes, kardex, reposición. |
| Distribuidores | [distribuidores.md](./distribuidores.md) | Listado, detalle y operaciones de distribuidores. |
| Reportes | [reportes.md](./reportes.md) | Reportes de ventas/financieros y exportación. |
| Configuración y cuenta | [configuracion-cuenta.md](./configuracion-cuenta.md) | settings, empresa, perfil, notificaciones, pagos, suscripción. |
| Plataforma (super-admin) | [plataforma.md](./plataforma.md) | Empresas, planes, suscriptores, plantillas, auditoría, ajustes. |
| Librerías y cliente API | [lib-cliente-api.md](./lib-cliente-api.md) | `api.ts`, validaciones, types, hooks, stores, SDK. |

## Puntos de entrada de interés

- `frontend/lib/api.ts` — `apiFetch`, `getAccessToken`; manejo central de errores de límite/plan.
- `frontend/lib/plan-capabilities.ts` y `plan-capabilities-server.ts` — mapa módulo→rutas.
- `frontend/components/auth/page-guard.tsx` — protección de páginas por rol/permiso.
- `frontend/components/plan-capabilities/plan-route-guard.tsx` — protección por plan.
