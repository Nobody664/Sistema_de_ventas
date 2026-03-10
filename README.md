# Sistema SaaS de Ventas Multi-Empresa

Base inicial de un SaaS multi-tenant para ventas e inventario con:

- `frontend/`: Next.js App Router para landing, dashboard y experiencia operativa.
- `backend/`: NestJS con arquitectura por dominios, Prisma y seguridad base.
- `docs/`: decisiones de arquitectura, plan de desarrollo y resumen de las primeras aplicaciones.

## Estrategia multi-tenant elegida

Se adopta un modelo `shared database + shared schema + tenant_id` con aislamiento a nivel aplicación y base de datos:

- `companyId` obligatorio en entidades de negocio.
- `PostgreSQL Row Level Security` como siguiente capa de endurecimiento.
- Índices compuestos por `companyId` y columnas de consulta frecuente.
- Evolución híbrida para migrar tenants enterprise a schema o base dedicada sin rehacer el dominio.

## Inicio rápido

1. Copia `backend/.env.example` a `backend/.env`.
2. Copia `frontend/.env.example` a `frontend/.env.local`.
3. Instala dependencias con `npm i`.
4. Ejecuta `npm run dev:backend` y `npm run dev:frontend`.

## Documentación clave

- `docs/architecture.md`
- `docs/development-plan.md`
- `docs/initial-apps-summary.md`

