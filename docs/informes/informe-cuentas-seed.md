# Seed de datos de demostración

Ejecuta `npm run db:seed` desde `backend`. El script requiere `SEED_DEFAULT_PASSWORD`, configurada únicamente en el entorno local o en el entorno de desarrollo correspondiente.

El seed crea planes y registros de demostración mediante `upsert`, por lo que puede repetirse. Actualiza roles y algunos campos de las cuentas demo, pero no reemplaza las contraseñas de usuarios existentes. No lo ejecutes contra producción.

Para cambios del schema, crea una migración y despliega con `npx prisma migrate deploy`. No uses `prisma db push` como sustituto de las migraciones en una base compartida.
