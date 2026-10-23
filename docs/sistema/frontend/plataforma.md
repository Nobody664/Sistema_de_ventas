# Área: Plataforma (super administración)

Consola de administración global para super administradores (`SUPER_ADMIN` y
`SUPPORT_ADMIN`): gestión de empresas, planes, suscriptores, plantillas de
facturación, solicitudes de upgrade, auditoría y configuración de pagos. Ruta del
código: `frontend/app/(platform)/` y `frontend/components/companies|subscribers`.

## Rutas y páginas

| Ruta | Archivo | Tipo (server/client) | Descripción |
|------|---------|----------------------|-------------|
| `/platform` | `frontend/app/(platform)/platform/page.tsx` | server (async component) | Panel principal con tarjetas de acceso a Empresas, Suscriptores, Solicitudes de upgrade, Planes, Plantillas, Configuración de pagos y Auditoría. |
| `/platform/companies` | `frontend/app/(platform)/platform/companies/page.tsx` | server (async component) | Lista todas las empresas (`API('/companies')`) con `CompanyActions` y `NewCompanyButton`. |
| `/platform/plans` | `frontend/app/(platform)/platform/plans/page.tsx` | server (async component) | Redirige a `/forbidden` si el usuario no es admin; carga `API('/plans')` y renderiza `PlansClient`. |
| `/platform/subscribers` | `frontend/app/(platform)/platform/subscribers/page.tsx` | server (async component) | Lista suscriptores (`API('/subscriptions/subscribers')`) con `SubscriberActions`. |
| `/platform/templates` | `frontend/app/(platform)/platform/templates/page.tsx` | server (async component) | Solo `SUPER_ADMIN`; carga `API('/invoices/templates')` y renderiza `InvoicesTemplatesClient`. |
| `/platform/templates/new` | `frontend/app/(platform)/platform/templates/new/page.tsx` | server (async component) | Crea una plantilla. Usa `searchParams.type` para pasar un preset a `TemplateEditor` (`template={null}`). |
| `/platform/templates/[id]` | `frontend/app/(platform)/platform/templates/[id]/page.tsx` | server (async component) | Edita una plantilla; busca la plantilla por `id` y pasa `template` (o `null`) a `TemplateEditor`. |
| `/platform/upgrade-requests` | `frontend/app/(platform)/platform/upgrade-requests/page.tsx` | client (`'use client'`) | Protegida con `PageGuard requiredRoles={['SUPER_ADMIN','SUPPORT_ADMIN']}`. Con pestañas "Checkout" y "Suscripciones"; la de Checkout lista las solicitudes pendientes (`GET /payments/checkout/requests/pending`) y permite revisar el comprobante, aprobar o rechazar con notas. |
| `/platform/audit` | `frontend/app/(platform)/platform/audit/page.tsx` | server (async component) | Carga `API('/audit/global')` y renderiza `.items`. |
| `/platform/settings/payment` | `frontend/app/(platform)/platform/settings/payment/page.tsx` | server (async component) | Solo `SUPER_ADMIN`; renderiza `PaymentSettingsManager`. |

El layout `frontend/app/(platform)/layout.tsx` valida la sesión: exige rol
`SUPER_ADMIN`/`SUPPORT_ADMIN` y redirige a `/forbidden` en caso contrario.

## Componentes

- `frontend/components/companies/company-actions.tsx` — `CompanyActions` y
  `NewCompanyButton`. `CompanyActions` abre edición (`CompanyModal`) y cambia el
  estado de la empresa (`PATCH /companies/{id}/status`) con confirmación y
  `router.refresh()`; los botones se envuelven en `PermissionGuard`.
  `NewCompanyButton` abre `CompanyModal` para crear una empresa.
- `frontend/components/companies/company-modal.tsx` — `CompanyModal`. Diálogo de
  alta/edición de empresa. En modo "create" genera el slug automáticamente
  (`generateSlug`).
- `frontend/components/companies/company-with-plan-modal.tsx` —
  `CompanyWithPlanModal`. Crea una empresa con plan seleccionando plan, moneda
  (`PEN` por defecto) y zona horaria (`America/Lima` por defecto); envía
  `POST /companies/with-plan`.
- `frontend/components/subscribers/subscriber-actions.tsx` —
  `SubscriberActions`. Aprueba o rechaza suscriptores/empresas en prueba.
  Muestra un diálogo para ingresar el motivo del rechazo.
- `frontend/app/(platform)/platform/templates/invoices-templates-client.tsx` —
  `InvoicesTemplatesClient` (`{ templates, companies? }`). Lista plantillas de
  facturación agrupadas por tipo, con tarjetas-preset (`templatePresets`:
  BOLETA/A4, TICKET/thermal, FACTURA/A4) para crear, botones para editar
  (`/platform/templates/{id}`) y eliminar (`DELETE /invoices/templates/{id}`,
  vía `useMutation` con invalidación de `invoice-templates`). Los creadores
  navegan a `/platform/templates/new?type={tipo}`.
- `frontend/app/(platform)/platform/templates/template-editor.tsx` —
  `TemplateEditor` (`{ template: InvoiceTemplate | null, preset? }`). Editor de
  plantillas cliente con:
  - Selección de tipo `BOLETA` / `TICKET` / `FACTURA` (TICKET fuerza
    `paperSize: 'thermal'`).
  - Campos: nombre, descripción, tamaño de papel (`A4`/`A5`/`thermal`), fuente,
    tamaño de fuente, IGV (`taxPercentage`, 18 por defecto), texto de pie y una
    matriz de toggles `show*` (logo, empresa, cliente, vendedor, productos,
    número, fecha, hora, método de pago, subtotal, IGV, descuento).
  - `createMutation` (`POST /invoices/templates`, invalida `invoice-templates`) y
    `updateMutation` (`PATCH /invoices/templates/{id}`); al guardar con éxito
    navega a `/platform/templates`.
  - Vista previa con `ThermalPreview` (58mm/200px) o `StandardPreview`
    (A4 600px / A5 420px) usando datos de ejemplo.

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `/platform/companies` (server) | `GET /companies` | `API('/companies')` (`serverApiFetch`) | Listado de empresas. |
| `CompanyModal` | `POST /companies` | `apiFetch<Company>` | Creación de empresa desde el modal. |
| `CompanyModal` | `PATCH /companies/{id}` | `apiFetch<Company>` | Edición de empresa. |
| `CompanyActions` | `PATCH /companies/{id}/status` | `apiFetch` | Cambia el estado (`isActive`) de la empresa; luego `router.refresh()`. |
| `CompanyWithPlanModal` | `POST /companies/with-plan` | `apiFetch` | Crea empresa con plan (queda pendiente de aprobación). |
| `/platform/plans` (server) | `GET /plans` | `API('/plans')` | Listado de planes. |
| `/platform/subscribers` (server) | `GET /subscriptions/subscribers` | `API('/subscriptions/subscribers')` | Listado de suscriptores. |
| `SubscriberActions` | `PATCH /subscriptions/subscribers/{id}/approve` | `apiFetch` | Aprueba al suscriptor. |
| `SubscriberActions` | `PATCH /subscriptions/subscribers/{id}/reject` | `apiFetch` | Rechaza al suscriptor con `{ reason }`. |
| `/platform/templates` (server) | `GET /invoices/templates` | `API('/invoices/templates')` | Datos iniciales de plantillas. |
| `InvoicesTemplatesClient` | `GET /invoices/templates` | `apiFetch<InvoiceTemplate[]>` (React Query, `initialData`) | Lista de plantillas. |
| `InvoicesTemplatesClient` | `GET /companies` | `apiFetch` (React Query, `initialData`) | Empresas (para datos de RUC/dirección/teléfono). |
| `InvoicesTemplatesClient` | `DELETE /invoices/templates/{id}` | `apiFetch` (`useMutation`) | Elimina una plantilla e invalida `invoice-templates`. La navegación usa `router.push` a `/platform/templates/new` o `/platform/templates/{id}`. |
| `/platform/templates/new` (server) | — | — | Solo prepara `preset` según `searchParams.type`. |
| `/platform/templates/[id]` (server) | — | — | Carga la plantilla desde el listado y la pasa al editor. |
| `TemplateEditor` | `POST /invoices/templates` | `apiFetch<InvoiceTemplate>` (React Query `useMutation`) | Crea plantilla; invalida `invoice-templates`; navega a `/platform/templates`. |
| `TemplateEditor` | `PATCH /invoices/templates/{id}` | `apiFetch<InvoiceTemplate>` | Actualiza plantilla; invalida `invoice-templates`. |
| `/platform/upgrade-requests` (Checkout) | `GET /payments/checkout/requests/pending` | `apiFetch<CheckoutRequest[]>` (React Query `checkout-requests`, `enabled` solo en la pestaña Checkout) | Solicitudes de checkout pendientes. |
| `/platform/upgrade-requests` (Checkout) | `PATCH /payments/checkout/requests/{id}/review` | `apiFetch` (`useMutation`) | Cuerpo `{ status: 'APPROVED' \| 'REJECTED', reviewNotes }`. Invalida `checkout-requests` y `upgrade-requests`. |
| `/platform/upgrade-requests` (Suscripciones) | `POST /subscriptions/upgrade-requests/{id}/review` | `apiFetch` (`useMutation`) | Cuerpo `{ status: 'APPROVED' \| 'REJECTED', reviewNotes }`. Solo se invoca sobre la pestaña "Suscripciones" (actualmente no carga datos; ver Notas). |
| `/platform/audit` (server) | `GET /audit/global` | `API('/audit/global')` | Renderiza `.items`. |
| `/platform/settings/payment` (server) | — | — | Monta `PaymentSettingsManager` (ver `configuracion-cuenta.md` para sus endpoints). |

## Estado global

- `frontend/store/ui-store.ts` — `useUiStore.addToast` para notificaciones de
  éxito/error en los componentes cliente.
- React Query (`@tanstack/react-query`) en `TemplateEditor` para las mutaciones
  de plantillas y para invalidar `invoice-templates`.
- `useRouter` de `next/navigation` para los `router.refresh()` y navegación
  tras las acciones.
- No se ha verificado en el código el uso de un store Zustand dedicado a
  plataforma.

## Flujo de usuario

1. El super administrador entra a `/platform` y accede desde las tarjetas a las
   distintas secciones.
2. En `/platform/companies` crea empresas (`NewCompanyButton` / `CompanyModal` o
   `CompanyWithPlanModal`) o edita/cambia el estado de una existente con
   `CompanyActions`.
3. En `/platform/plans` administra los planes con `PlansClient`
   (alta/edición/borrado/activación).
4. En `/platform/subscribers` aprueba o rechaza suscriptores con
   `SubscriberActions`.
5. En `/platform/templates` gestiona plantillas de facturación; desde
   `/platform/templates/new` (con `?type=`) o `/platform/templates/{id}` usa
   `TemplateEditor` para configurarlas y ver la vista previa antes de guardar.
6. En `/platform/upgrade-requests` revisa las solicitudes pendientes (pestaña
   "Checkout"), abre el comprobante y las aprueba o rechaza con una nota.
7. En `/platform/audit` consulta el registro global de auditoría.
8. En `/platform/settings/payment` configura los proveedores de pago globales con
   `PaymentSettingsManager`.

## Notas

- El acceso está restringido por el layout de `(platform)` a `SUPER_ADMIN` y
  `SUPPORT_ADMIN`; además, algunas páginas restringen a `SUPER_ADMIN`
  (planes, plantillas, configuración de pago).
- `PlansClient` está documentado en detalle en
  `docs/sistema/frontend/configuracion-cuenta.md` (componente compartido).
- `PaymentSettingsManager` se comparte con la configuración de cuenta; ver
  `configuracion-cuenta.md`.
- La zona horaria `America/Lima` y la moneda `PEN` son los valores por defecto al
  crear una empresa con plan.
- En `/platform/upgrade-requests` la pestaña "Checkout" carga
  `GET /payments/checkout/requests/pending`, pero la pestaña "Suscripciones"
  (`activeTab === 'subscriptions'`) no ejecuta ninguna consulta: `requests` queda
  como array vacío, por lo que el endpoint `POST /subscriptions/upgrade-requests/{id}/review`
  no llega a dispararse desde la UI.
