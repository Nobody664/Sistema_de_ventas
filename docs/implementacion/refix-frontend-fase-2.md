# Refix frontend — Fase 2

Rama: `refix/frontend-fase-2`, creada desde `main` (`695ddbf`, cierre de la Fase 1).

Alcance: F-05, F-06, F-07 y F-08 del informe técnico frontend del 23 de octubre de 2026.

## F-05 — Cierre de sesión

- `stores/auth.store.ts` expone `logout(): Promise<boolean>`. Solo limpia `user`, `isAuthenticated` y el error cuando el backend confirma el cierre; si falla la red o el servidor responde con error, conserva la sesión, deja de cargar y devuelve `false`.
- `components/layout/app-header.tsx` espera el resultado. En éxito reinicia notificaciones, cancela consultas en vuelo, limpia el `QueryClient`, navega a `/sign-in` y refresca el árbol SSR. En fallo muestra un error y no navega.
- Se añadieron tres pruebas en `stores/auth-logout.test.ts`: error 500, fallo de red y cierre confirmado.

## F-06 — Tipo de solicitud de upgrade

- El rechazo de identificadores CUID descrito en F-06 ya fue resuelto en las fases backend con `EntityIdPipe`. `app/(platform)/platform/upgrade-requests/page.tsx` mantiene `type: activeTab` en aprobación y rechazo y elimina el cast incorrecto `as "checkout"`; ese cast no cambiaba el valor enviado en ejecución.
- `components/subscriptions/upgrade-plan-modal.tsx` normaliza el mensaje de error con `err instanceof Error` antes de mostrarlo.

## F-07 — Plantillas de factura

- `template-editor.tsx` ya no mantiene un estado local `isGlobal`: el editor de plataforma crea plantillas con `POST /invoices/templates/global`. El payload deja de enviar `isGlobal`, campo que el DTO no admite con la validación estricta del backend.
- `invoices-templates-client.tsx` elimina la consulta y la propiedad `companies`, que no se usaban en la pantalla.

## F-08 — Presentaciones, cantidades y distribuidor

### Backend

- Se añadió `GET /distributors/:id/stock`, restringido a `COMPANY_ADMIN`/`MANAGER` con `DISTRIBUTOR_VIEW`. Valida que el distribuidor pertenezca a la empresa y devuelve solo productos con stock consignado positivo (`productId` y `quantity`, ordenados por producto).
- Se añadió una prueba de servicio para el alcance del distribuidor y el filtro `quantity > 0`.
- El flujo de venta ya comparte `resolveSaleLines`/`saleAmounts`: el precio de presentación usa su precio propio o `salePrice × factor`, la cantidad se limita a tres decimales y el servidor calcula el total. No se añadió un endpoint de cotización.

### Frontend

- `lib/sale-quantity.ts` centraliza la precisión por unidad: milésimas para `KG`, `LT` y `MT`; enteros para `UNIT` y presentaciones. También limita contra stock y redondea importes a dos decimales.
- `components/sales/quantity-input.tsx` permite escribir cantidades fraccionarias, acepta coma decimal, aplica el máximo al confirmar y restaura el valor anterior con Escape.
- `sale-form.tsx` ahora:
  - calcula precios y totales como el backend;
  - consulta el stock consignado al elegir distribuidor y filtra los productos por ese stock;
  - deshabilita presentaciones cuya conversión excede el stock;
  - no permite vender una fracción de una presentación;
  - limpia el carrito al entrar o salir del canal distribuidor y al cambiar de distribuidor;
  - muestra carga, error o ausencia de stock consignado;
  - muestra en la confirmación el total devuelto por el servidor; si falta o es inválido, conserva la venta registrada y pide consultar su detalle antes de cobrar, sin presentar un cálculo local como confirmado.
- La pantalla administrativa `distributor-operations.tsx` conserva su flujo anterior. El alcance de F-08 son el checkout y el endpoint de venta a distribuidor; no se amplió ese formulario separado.

## Verificación

Ejecutado desde `frontend` y `backend`:

```text
npm run lint
npm test
npm run build
node node_modules/prettier/bin/prettier.cjs --check <archivos modificados>
git diff --check
```

Resultado:

- Frontend: **22 pruebas aprobadas**, 0 fallos; build de **62 páginas**.
- Backend: **312 pruebas aprobadas**, 0 fallos; build correcto.
- Prettier y `git diff --check` sin errores.

No se automatizó el recorrido completo en navegador para venta por peso, presentaciones y stock consignado. Queda pendiente la validación manual con un distribuidor con stock parcial y un producto con presentación sin precio propio.

## Cierre

Fase 2 completada en commit local. No se hizo push.
