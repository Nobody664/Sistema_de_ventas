# Refix backend — Fase 4

Rama: `refix/backend-fase-4`, creada desde la Fase 3 (`b04786a`).

Alcance: hallazgos B-13, B-14, B-15 y B-16 del informe técnico backend del 23 de octubre de 2026.

## B-13 — Audiencia de notificaciones

- `GET /api/notifications/company` requiere el rol `COMPANY_ADMIN`, el permiso `COMPANY_VIEW_AUDIT` y contexto de empresa. El rol recibe ese permiso en el catálogo central; `SUPER_ADMIN` conserva el acceso administrativo con contexto de tenant.
- El servicio también comprueba rol y coincidencia de empresa antes de consultar. La consulta mantiene `companyId` y `scope: COMPANY`.
- La bandeja personal continúa ligada al usuario autenticado.
- Una regresión HTTP comprueba invitados, cajeros, gerentes, almacén, soporte, administrador de empresa y bandeja personal. La autenticación se simula en esta prueba; los guards de roles, tenant y permisos son reales.

## B-14 — Contratos de PATCH y fechas

- `rejectNullFields` convierte los `null` no admitidos en respuestas 400 antes de construir valores Decimal o escribir campos obligatorios.
- `optionalDate` distingue omisión, borrado explícito y fecha válida. Rechaza fechas de calendario imposibles y cadenas no ISO.
- Cuentas y movimientos de plataforma protegen importes y campos obligatorios; las notas de cuenta permiten borrado explícito.
- Proveedores API protegen los campos obligatorios frente a `null`.
- Un PATCH de producto conserva su estado cuando omite `isActive`; `categoryId: null` elimina la categoría. La fecha de vencimiento tiene validación ISO estricta y los precios de producto no admiten valores negativos ni más de dos decimales.
- La completitud del perfil empresarial se recalcula combinando estado persistido y campos enviados. Conserva la fecha de completitud si sigue completo y la limpia si deja de estarlo. Los datos opcionales de contacto permiten borrado explícito.
- El identificador de plan al crear una empresa admite los identificadores opacos usados por Prisma, en lugar de exigir exclusivamente UUID.

## B-15 — Registro atómico

- El hash de contraseña se calcula antes de abrir la transacción.
- Dentro de una única transacción serializable se verifican correo y plan activo, y se crean empresa, suscripción, propietario, membresía y sesión.
- La creación de sesión recibe el cliente transaccional para evitar una transacción anidada o una sesión persistida separadamente.
- El slug incorpora un UUID para reducir colisiones entre registros simultáneos.
- Las pruebas comprueban éxito en una sola unidad de trabajo, plan inexistente sin escrituras y rollback completo ante fallo al guardar la sesión.

## B-16 — Operaciones y efectos auxiliares

### Unidad de trabajo

- La revisión de comprobantes comparte transacción con la confirmación del pago, activación, auditoría y evento de outbox. Un fallo posterior a marcar el comprobante revierte el conjunto.
- Los comprobantes nuevos se vinculan a un pago offline. La carga por suscripción valida importe, fecha y ciclo, y crea o reutiliza un pago pendiente compatible. Los comprobantes históricos sin vínculo requieren una conciliación compatible antes de aprobarse.
- El settlement manual reutilizable verifica los permisos vigentes del revisor en base de datos. Las intenciones online se confirman mediante su proveedor.
- Las solicitudes de checkout conservan su ciclo contratado, usan cálculo de períodos con límites de mes/año y registran `paidAt`. Las históricas sin ciclo exigen conciliación explícita y justificación.
- Checkout enviado y revisión de upgrades/checkout guardan el cambio y su evento juntos. Repetir la misma decisión devuelve el resultado ya registrado; reenviar la misma imagen de checkout ya enviado no duplica el evento.
- La venta guarda el evento `SALE_COMMITTED` en su transacción. La alerta de stock se procesa posteriormente.
- Billing genera el importe mensual o anual correspondiente y conserva plan/ciclo en el snapshot del pago pendiente.

### Outbox persistente

`OutboxEvent` almacena identificación del agregado, tipo de efecto y clave de deduplicación; no copia contraseñas, tokens ni comprobantes. Los efectos actuales son:

- `PAYMENT_CONFIRMED`
- `UPGRADE_REVIEWED`
- `CHECKOUT_SUBMITTED`
- `CHECKOUT_REVIEWED`
- `SALE_COMMITTED`

El worker consulta hasta 25 eventos cada 10 segundos. Reclama cada evento mediante escritura condicional, usa un token de lease y renueva el bloqueo cada 30 segundos. Un bloqueo sin renovar durante 120 segundos se puede recuperar. La confirmación y el registro de fallo están condicionados a seguir teniendo el token.

Los errores dejan el evento pendiente con backoff exponencial y un límite de 10 intentos automáticos. El reintento manual reinicia los intentos dentro de una transacción con auditoría. `lastError` usa un código sin contenido sensible.

El worker vuelve a consultar proyecciones de los agregados y destinatarios administrativos activos. Crea notificaciones IN_APP con clave única por evento, audiencia y usuario. La colisión de clave al crear una notificación recupera el registro existente. Los avisos de empresa y plataforma tienen espacios de deduplicación distintos.

El correo sale desde el worker con timeouts SMTP y un `Message-ID` estable. La entrega es **al menos una vez**: si SMTP acepta un mensaje y el proceso falla antes de confirmar el evento, puede repetirse, también para destinatarios ya atendidos dentro del mismo evento. Un Message-ID estable no garantiza deduplicación por el servidor de correo. SMTP deshabilitado deja el evento pendiente en lugar de marcar una entrega inexistente.

### Operación

Solo `SUPER_ADMIN` con `PLATFORM_MANAGE_SETTINGS` puede utilizar:

- `GET /api/platform/outbox`: hasta 100 eventos pendientes, ordenados por antigüedad y con proyección operativa.
- `POST /api/platform/outbox/:id/retry`: reintento auditado, rechazado si el evento ya terminó o mantiene un lease vigente.

Los errores de entrega no cambian el resultado del negocio ya confirmado. La invalidación de caché asociada a los eventos se reintenta con el outbox; los avisos son eventualmente consistentes.

## Migración preparada

`backend/prisma/migrations/20261103000000_transactional_effects/migration.sql` incorpora:

1. Tabla e índices de outbox.
2. Clave única nullable de deduplicación en notificaciones.
3. Vínculo opcional comprobante/pago y un índice único parcial para un comprobante pendiente por pago vinculado.
4. Ciclo de facturación nullable en checkout para permitir conciliar registros históricos.

El esquema fue formateado con Prisma; el diff incluye alineación de modelos preexistentes sin cambios semánticos adicionales en esos bloques.

**La migración no fue aplicada a la base compartida.** El despliegue de este código requiere aplicar primero las migraciones pendientes de las fases correspondientes y regenerar el cliente Prisma en el entorno de destino.

## Verificación

Ejecutado desde `backend`:

```text
npx prisma validate
npx prisma format
npx prisma generate
npm run lint
npm run build
npm run format
node -r ts-node/register -r tsconfig-paths/register --test --test-concurrency=2 "src/**/*.spec.ts"
```

Resultado: **270 pruebas aprobadas, 79 suites, 0 fallos**, incluyendo 26 pruebas nuevas respecto de Fase 3. `git diff --check` también aprobado.

Las pruebas nuevas cubren contratos públicos, acceso HTTP a notificaciones, registro, rollback de comprobante/settlement/outbox, checkout con SMTP indisponible, deduplicación y recuperación/reintentos del worker. Las pruebas de atomicidad y concurrencia usan repositorios simulados: no sustituyen una ejecución de migraciones y concurrencia contra PostgreSQL de integración. No se realizó entrega SMTP real, prueba de navegador ni prueba real del sandbox MercadoPago en esta fase.

La fase queda preparada para integración mediante commit local. B-17–B-20 corresponden a la siguiente fase.
