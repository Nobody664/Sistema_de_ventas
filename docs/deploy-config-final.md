# Configuración de despliegue vigente

El frontend se despliega en Vercel; la API NestJS y Prisma se despliegan en Render; PostgreSQL reside en Supabase.

La fuente de configuración de Render es el archivo raíz `render.yaml`. Los secretos se configuran en Render Dashboard mediante variables marcadas `sync: false`; no se guardan credenciales en este documento ni en el manifiesto.

El backend arranca con `npm run start`. Las migraciones se aplican como paso explícito con `npx prisma migrate deploy`, no mediante `prisma db push` en cada reinicio.

Consulta `DEPLOY_RENDER.md` para las variables y pasos operativos. En Vercel solo deben configurarse la URL de la API y las variables públicas requeridas por Next.js/Supabase.
