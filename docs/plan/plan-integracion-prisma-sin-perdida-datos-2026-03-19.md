# Plan de Solucion e Integracion Prisma (sin eliminar datos)

Fecha: 2026-03-19
Proyecto: `backend` (NestJS + Prisma + PostgreSQL)
Objetivo: normalizar flujo Prisma en desarrollo y despliegue sin reset destructivo.

## 1) Diagnostico actual

Estado verificado hoy:

- `npx prisma migrate status` => **Database schema is up to date**.
- Existe 1 migracion en `backend/prisma/migrations`.
- El esquema actual ya fue sincronizado con la BD via `prisma db push`.

Implicacion:

- Operativamente el sistema funciona.
- Riesgo pendiente: que futuras migraciones fallen por historial no consistente entre ambientes si se sigue usando solo `db push`.

## 2) Principio de seguridad (no perdida de datos)

Reglas obligatorias:

1. No usar `prisma migrate reset` en BD con datos reales.
2. Hacer backup antes de cualquier cambio estructural.
3. Separar flujos:
   - `db push` solo para prototipado local rapido.
   - `migrate` para cambios versionados/repetibles en equipo.

## 3) Plan de integracion recomendado

## Fase A - Respaldo y verificacion previa

1. Backup logico de PostgreSQL:

```bash
pg_dump -h localhost -U <usuario> -d multi-saass -F c -f prisma_pre_migration.backup
```

2. Validar estado Prisma:

```bash
npx prisma validate
npx prisma format
npx prisma migrate status
```

3. Confirmar que app compila:

```bash
npm run prisma:generate
npm run lint
```

## Fase B - Congelar baseline de migraciones sin tocar datos

Objetivo: dejar una base versionada confiable para siguientes cambios.

Estrategia segura:

1. Crear una BD clon temporal (ej. `multi-saass_shadow`) para comparar sin riesgo.
2. Si aparece drift en futuro, usar `prisma migrate diff` para auditar SQL antes de aplicar:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma_drift_diff.sql
```

3. Revisar manualmente `prisma_drift_diff.sql` (evitar drops no deseados).
4. Si el historial necesita alineacion sin ejecutar SQL destructivo, usar `prisma migrate resolve --applied` sobre migraciones ya reflejadas en BD.

Nota:

- `resolve --applied` marca historial; no modifica tablas/datos.

## Fase C - Flujo estandar para nuevos cambios

Desde este punto, para cada cambio de schema:

1. Editar `prisma/schema.prisma`.
2. Crear migracion versionada:

```bash
npx prisma migrate dev --name <nombre_cambio>
```

3. Generar cliente y validar:

```bash
npx prisma generate
npm run lint
```

4. En CI/CD o entorno compartido:

```bash
npx prisma migrate deploy
```

## Fase D - Politica por entorno

- Local dev: `migrate dev` (preferido) y `db push` solo cuando se este explorando.
- Staging/Produccion: solo `migrate deploy`.
- Bloquear `migrate reset` salvo aprobacion explicita y backup validado.

## 4) Integracion con NestJS

Para evitar desalineaciones entre Prisma client y runtime:

1. Mantener `npm run prisma:generate` como paso previo a `build` y `lint` cuando cambie schema.
2. En despliegue, orden recomendado:
   - `prisma migrate deploy`
   - `prisma generate`
   - `nest build` / `npm run start`

## 5) Checklist operativo (rapido)

- [ ] Backup generado y verificable.
- [ ] `prisma migrate status` en verde.
- [ ] `prisma generate` sin errores.
- [ ] `npm run lint` backend en verde.
- [ ] No uso de `reset` en BD con datos.
- [ ] Nuevos cambios via `migrate dev` + `migrate deploy`.

## 6) Resultado esperado

Con este plan:

- Se preservan todos los datos existentes.
- Se elimina el riesgo operativo de drift recurrente.
- El equipo obtiene un flujo Prisma reproducible y seguro para siguientes fases (chat/soporte/tickets y modulos futuros).
