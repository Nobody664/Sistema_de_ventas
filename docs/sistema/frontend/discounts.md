# Área: Cupones de descuento

Alta, edición y listado de cupones de descuento con cupo de usos (`maxUses`), vigencia
(`startsAt`/`expiresAt`), compra mínima (`minPurchase`) y activación/desactivación. Ver el listado está
disponible para `COMPANY_ADMIN` y `MANAGER`; crear, editar y desactivar es exclusivo de
`COMPANY_ADMIN` (los botones usan `PermissionGuard permission="discount:manage"`). Los cupones se
consumen en el POS (ver `ventas.md`). Ruta del código:
`frontend/app/(dashboard)/discounts/` y `frontend/components/discounts/`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/discounts` | `frontend/app/(dashboard)/discounts/page.tsx` | server (`dynamic = 'force-dynamic'`) | Lista cupones. Redirige a `/sign-in` sin sesión y a `/dashboard` si el rol no es `COMPANY_ADMIN`. Consume la respuesta paginada `{ items, total, page, limit, totalPages }` de `GET /discounts` (lee `?page=`). |
| `/discounts/new` | `frontend/app/(dashboard)/discounts/new/page.tsx` | server | Guardas de sesión/rol; renderiza `DiscountForm` (creación). |
| `/discounts/[id]/edit` | `frontend/app/(dashboard)/discounts/[id]/edit/page.tsx` | server | Guardas de sesión/rol; precarga `GET /discounts/:id` y renderiza `DiscountForm` (edición); `notFound()` si no existe. |

### Listado

- Hero con gradiente emerald→teal, contador de total y de activos en la página, y `NewDiscountButton`.
- Grilla responsive (`sm:2 / lg:3`) de tarjetas con: código (monoespaciado), descripción, badge de
  estado, valor (`-10%` o `-S/ 0.00`), compra mínima, barra de usos (`used / maxUses`, o
  `used · ilimitado`) y vigencia (`inmediata` / `sin expiración` cuando no hay fechas).
- Estado derivado en cliente (`getStatus`): `Desactivado` (`isActive === false`) → `Programado`
  (`startsAt` futuro) → `Expirado` (`expiresAt` pasado) → `Agotado` (`usedCount >= maxUses`) →
  `Activo`.
- Paginación con enlaces `?page=` (Anterior/Siguiente) solo si `totalPages > 1`.

## Componentes

- `frontend/components/discounts/discount-form.tsx` — `DiscountForm` (cliente). Dos secciones:
  "Código y descuento" (código en mayúsculas, select nativo de tipo `PERCENTAGE`/`FIXED`, valor) y
  "Cupo, vigencia y estado" (`maxUses`, `minPurchase`, fechas, `Switch` de `isActive`). Valida con
  Zod (`createDiscountCouponSchema`/`updateDiscountCouponSchema` de
  `frontend/lib/validations/discount.validation.ts`), envía `POST /discounts` o `PATCH /discounts/:id`
  con `apiFetch`, usa `handleLimitError` para errores de plan, `addToast` (`useUiStore`) y
  `router.replace('/discounts')` tras el éxito (invalida `['discounts']`).
- `frontend/components/discounts/discount-actions.tsx` — `NewDiscountButton` (enlace a
  `/discounts/new`), `DiscountActions` (enlace a editar + `DeleteDialog entity="discount"` con
  `successMessage="Cupón desactivado correctamente"`; se oculta si `isActive === false`) y
  `DiscountEmptyState` (estado vacío con CTA).
- `frontend/components/layout/app-sidebar.tsx` — entrada del menú
  `{ label: 'Cupones', href: '/discounts', icon: TicketPercent, module: 'sales', roles: ['COMPANY_ADMIN'] }`.

### Formulario (notas de implementación)

- Los campos opcionales envían `null` explícito para limpiarlos en edición (`description`, `maxUses`,
  `minPurchase`, `startsAt`, `expiresAt`); `class-transformer` + `@IsOptional()` los descartan cuando
  no viajan en el body.
- Fechas: el input `date` se convierte a ISO con `T00:00:00` (`startsAt`) y `T23:59:59` (`expiresAt`).
- El body siempre parte de `''` → `null` en campos opcionales y de `''` → `undefined` en `value`
  (zod lo rechaza vacío con `invalid_type_error`).

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `/discounts` (server) | `GET /discounts?page=` | `serverApiFetch<DiscountListResponse>` | Respuesta `{ items, total, page, limit, totalPages }`. |
| `/discounts/[id]/edit` (server) | `GET /discounts/:id` | `serverApiFetch<DiscountCoupon>` | `null` → `notFound()`. |
| `DiscountForm` (creación/edición) | `POST /discounts` / `PATCH /discounts/:id` | `apiFetch` | Método según `coupon` prop; `handleLimitError`; invalida `['discounts']`. |
| `DeleteDialog` (eliminar) | `DELETE /discounts/:id` | `apiFetch` | El backend **desactiva** (`isActive: false`), no borra; invalida `['discounts']`. |
| `SaleForm` (POS, otra área) | `POST /discounts/validate` | `apiFetch` | Validación de código contra el subtotal; ver `ventas.md`. |

## Permisos y plan

- Páginas: guardas de servidor con `getServerSession()`; sin `COMPANY_ADMIN` → `redirect('/dashboard')`.
- Backend: listado/validación exigen `discount:list`; crear/editar/borrar exigen `discount:manage`
  (solo `COMPANY_ADMIN`) + módulo `sales` + feature `sales.discounts`. Ver
  `docs/sistema/backend/discounts.md` y `docs/sistema/roles-permisos-planes.md`.
- Tipos: `discount:list`/`discount:manage` en `frontend/types/permissions.ts` (también `discount:list`
  para `MANAGER`/`CASHIER`/`VIEWER`, por si en el futuro se expone el listado en otra vista).

## Estado global

- `useUiStore` (`frontend/store/ui-store.ts`) — `addToast` para éxito/error.
- TanStack Query — `invalidateQueries({ queryKey: ['discounts'] })` tras crear/editar/eliminar.
- `frontend/types/api.ts` — interfaz `DiscountCoupon`.

## Flujo de usuario

1. Desde el sidebar ("Cupones", solo `COMPANY_ADMIN`) entra a `/discounts` y ve las tarjetas con
   estado, usos y vigencia.
2. Pulsa "Nuevo cupón" y completa código, tipo/valor, cupo, vigencia y compra mínima; al guardar hace
   `POST /discounts`, invalida cachés y vuelve al listado.
3. En una tarjeta pulsa "Editar" para modificar (campos vacíos → `null` limpia el valor) o
   "Eliminar" para desactivar el cupón (`DeleteDialog`).
4. El cupón ya puede aplicarse en el POS (`POST /discounts/validate`) y se consume al confirmar la
   venta.

## Notas

- `DELETE /discounts/:id` es una desactivación lógica: el cupón sigue en el listado como
  "Desactivado" y puede reactivarse desde la edición (`isActive`).
- El listado es server-side con paginación (`?page=`); no hay filtro por estado/búsqueda en la UI
  aunque el backend soporta `isActive` y `search`.
- La UI de anulación/reembolsar una venta (que no devuelve el uso del cupón) no existe aún; ver
  `ventas.md`.
