# Resumen de las Primeras Aplicaciones

## 1. Backend API

Aplicación NestJS orientada a dominios con:

- autenticación JWT
- módulos base del negocio
- Prisma como acceso a datos
- guards de roles y tenant
- configuración preparada para Redis, BullMQ y pasarelas de pago

## 2. Frontend Web

Aplicación Next.js App Router con:

- landing page SaaS
- dashboard shell por rol
- utilidades compartidas para API, estado y tipado
- base visual pensada para evolucionar a estilo Stripe/Vercel/Linear

## 3. Infra local

Entorno local con:

- PostgreSQL 16
- Redis 7
- frontend y backend containerizados

## Siguiente paso recomendado

Implementar el flujo completo `registro -> empresa -> plan -> checkout -> webhook -> activación` antes de profundizar en módulos secundarios.
