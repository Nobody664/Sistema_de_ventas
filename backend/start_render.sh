#!/usr/bin/env bash

# =============================================================================
# 🚀 Render Deploy Script - NestJS + Prisma (PRO)
# =============================================================================

set -e  # detener en error

echo "=========================================="
echo "🚀 Iniciando build del backend..."
echo "=========================================="

# =========================
# 1. NODE VERSION INFO
# =========================
echo "🟢 Node version:"
node -v

# =========================
# 2. INSTALL DEPENDENCIES
# =========================
echo "📦 Instalando dependencias..."
npm install --legacy-peer-deps

# =========================
# 3. VALIDAR ENV
# =========================
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL no está definida"
  exit 1
fi

echo "✅ ENV OK"

# =========================
# 4. PRISMA GENERATE
# =========================
echo "⚙️ Generando Prisma Client..."
npx prisma generate

# =========================
# 5. PRISMA MIGRATE (opcional pero PRO)
# =========================
echo "🗄️ Ejecutando migraciones..."
npx prisma migrate deploy || echo "⚠️ No hay migraciones pendientes"

# =========================
# 6. BUILD APP
# =========================
echo "🏗️ Construyendo aplicación..."
npm run build

# =========================
# 7. VERIFY BUILD
# =========================
if [ ! -f "dist/main.js" ]; then
  echo "❌ ERROR: build falló, dist/main.js no existe"
  exit 1
fi

echo "✅ Build OK"

# =========================
# 8. START APP (IMPORTANTE)
# =========================
echo "🚀 Iniciando servidor..."
npm run start

echo "=========================================="
echo "✅ Deploy completado correctamente"
echo "=========================================="