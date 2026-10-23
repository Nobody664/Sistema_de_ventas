# Despliegue

## Arquitectura

- Frontend Next.js: Vercel.
- API NestJS: Render, configurada en `render.yaml`.
- PostgreSQL: Supabase, conectado únicamente desde el backend mediante Prisma.

## Render

El servicio usa `backend/scripts/build.sh` para instalar dependencias, generar Prisma Client y compilar. El proceso arranca con `npm run start`; el arranque no modifica el schema de la base.

Configura los secretos desde Render Dashboard, no en este repositorio:

- `DATABASE_URL`: Supabase Transaction Pooler para la API.
- `DIRECT_URL`: Supabase Session Pooler para migraciones.
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`.
- `REDIS_URL` si BullMQ/Redis está habilitado.

Aplica migraciones en el paso de despliegue con `npx prisma migrate deploy`. No ejecutes `prisma db push` automáticamente al iniciar el servicio.

## Vercel

Configura `NEXT_PUBLIC_API_URL` con la URL pública del backend y las variables públicas de Supabase que el frontend necesite. No agregues contraseñas PostgreSQL, `DATABASE_URL`, `DIRECT_URL` ni claves `service_role` al frontend.

## MercadoPago (integración inactiva)

MercadoPago está **implementado pero no activado**. Sus variables existen en `render.yaml` con `sync: false`, pero sin valores en el dashboard el sistema opera con normalidad: el proveedor queda deshabilitado y el webhook responde 401 por diseño. No configurar valores hasta decidir habilitar pagos internacionales.

Para activarlo en el futuro:

1. Definir en el dashboard de Render (nunca en el repositorio):
   - `MERCADOPAGO_ACCESS_TOKEN`: token de integración de la cuenta MercadoPago.
   - `MERCADOPAGO_WEBHOOK_SECRET`: secreto para validar la firma `X-Signature` (HMAC-SHA256 sobre `<data.id>.<ts>`).
2. Registrar el webhook en MercadoPago apuntando a `https://<backend>/api/payments/webhooks/mercadopago`.
3. Habilitar el proveedor en `PaymentSettings` (`PATCH /payments/settings/provider/MERCADOPAGO`, rol `SUPER_ADMIN`).

Sin `MERCADOPAGO_WEBHOOK_SECRET` el endpoint `POST /api/payments/webhooks/:provider` rechaza toda notificación (401) y no activa suscripciones; los tokens configurados como `PaymentSettings` permiten cobros por QR (Yape/Plin/Transferencia) sin depender de MercadoPago.

## Seguridad

Los valores marcados `sync: false` en `render.yaml` deben configurarse en el dashboard del servicio. Rota cualquier credencial que haya sido guardada previamente en archivos versionados y actualiza el dashboard correspondiente.
