#!/bin/bash
# =============================================================================
# Render Build + Start Script - Sistema de Ventas Backend
# =============================================================================

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "Iniciando build para Render..."
echo "=========================================="

# [1/5] Instalar dependencias
echo "[1/5] npm install..."
npm install --production=false

# [2/5] Generar Prisma Client
echo "[2/5] npx prisma generate..."
npx prisma generate

# [3/5] Compilar
echo "[3/5] npm run build..."
npm run build

# [4/5] Verificar build
echo "[4/5] Verificando build..."
if [ ! -f "dist/main.js" ]; then
    echo "ERROR: build failed (dist/main.js no existe)"
    exit 1
fi

echo "Build OK!"

# [5/5] Iniciar servidor en producción
echo "[5/5] Iniciando servidor..."

# Asegura entorno producción
export NODE_ENV=production

# IMPORTANTE: usar exec para que el proceso quede en foreground
exec node dist/main.js