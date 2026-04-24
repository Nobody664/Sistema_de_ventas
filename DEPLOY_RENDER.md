# 🚀 Despliegue en Render - Sistema de Ventas

## Configuración Automática (render.yaml)

El archivo `render.yaml` ya tiene la configuración necesaria:

```yaml
services:
  - type: web
    name: backend
    rootDir: backend          # ⚠️ IMPORTANTE
    buildCommand: npm install && npm run build
    startCommand: npm run start
    envVars:
      - key: NODE_ENV → production
      - key: NODE_VERSION → 20.19.0
      - key: PORT → 4000
      - key: JWT_ACCESS_SECRET → se genera automáticamente
      - key: JWT_REFRESH_SECRET → se genera automáticamente
      - key: NEXTAUTH_SECRET → se genera automáticamente
      - key: SMTP_ENABLED → false (desactivado)
      - key: DATABASE_URL → desde PostgreSQL
      - key: REDIS_URL → desde Redis
```

## ⚠️ Pasos en Render Dashboard

### 1. Crear Base de Datos
- **PostgreSQL**: `ventas-db`
- **Redis**: `ventas-redis`

### 2. Configurar el Servicio Web
- **Name**: `backend`
- **Root Directory**: `backend`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`

### 3. Environment Variables (automático desde render.yaml)
Si no usas render.yaml, configura manualmente:
```
NODE_ENV=production
PORT=4000
JWT_ACCESS_SECRET=(genera con openssl rand -base64 32)
JWT_REFRESH_SECRET=(genera con openssl rand -base64 32)
NEXTAUTH_SECRET=(genera con openssl rand -base64 32)
NEXTAUTH_URL=https://tu-frontend.onrender.com
SMTP_ENABLED=false
```

### 4. Health Check
- **URL**: `/api/health/ready`
- **Interval**: 30s

## 📋 Variables Requeridas

| Variable | Descripción | Required |
|----------|-------------|----------|
| NODE_ENV | production | ✅ |
| PORT | 4000 | ✅ |
| DATABASE_URL |Desde PostgreSQL | ✅ |
| REDIS_URL |Desde Redis | ✅ |
| JWT_ACCESS_SECRET | Secret JWT 32+ chars | ✅ |
| JWT_REFRESH_SECRET | Secret JWT 32+ chars | ✅ |
| NEXTAUTH_SECRET | Secret NextAuth 32+ chars | ✅ |
| SMTP_ENABLED | false (para desarrollo) | ✅ |

## 🔧 Comandos para verificar

```bash
# Verificar que Node sea 20.19+
node --version

# Probar build local
cd backend
npm install
npm run build

# Probar start local
npm run start
# Luego probar:
curl http://localhost:4000/api/health/live
```

## 🆘 Solución de Errores Comunes

### "nest: not found"
```bash
# Ya solucionado: npm run build usa "nest build"
```

### "Prisma only supports Node.js 20.19+"
```bash
# Ya solucionado: Node.js 20.19.0 en .nvmrc
```

### "baseUrl deprecated"
```bash
# Ya solucionado: ignoreDeprecations en tsconfig.json
```

### Error de DATABASE_URL
确保 haber creado la base de datos PostgreSQL en Render y linked correctly.

## ✅ Commit Actual
```bash
git add -A
git commit -m "config: actualizar render.yaml con todas las variables de entorno"
git push origin main
```

Luego haz **Manual Deploy** en Render desde el Dashboard.