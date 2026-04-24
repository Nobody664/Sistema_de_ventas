#!/bin/bash
# =============================================================================
# Render Build Script - Sistema de Ventas Backend
# =============================================================================

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "Iniciando build para Render..."
echo "=========================================="

# [1/4] Instalar dependencias
echo "[1/4] npm install..."
npm install --prefer-offline

# [2/4] Generar Prisma Client  
echo "[2/4] npx prisma generate..."
npx prisma generate

# [3/4] Compilar TypeScript usando node
echo "[3/4] node ./node_modules/@nestjs/cli/bin/nest-about.js build..."
node ./node_modules/@nestjs/cli/bin/nest-about.js build || node ./node_modules/@nestjs/cli/bin/nest.js build

# [4/4] Verificar que se creó dist/
if [ -f "dist/main.js" ]; then
    echo "=========================================="
    echo "Build completado!"
    echo "=========================================="
else
    echo "ERROR: dist/main.js no encontrado"
    exit 1
fi