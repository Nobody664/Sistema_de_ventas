#!/bin/bash
# =============================================================================
# Render Build Script - Sistema de Ventas Backend
# =============================================================================

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "Iniciando build para Render..."
echo "Node version: $(node --version)"
echo "=========================================="

# [1/5] Limpiar node_modules y package-lock
echo "[1/5] Limpiando cache previa..."
rm -rf node_modules package-lock.json

# [2/5] Instalar con Prisma 6 FORZADO
echo "[2/5] npm install forzando Prisma 6..."
npm install prisma@6 @prisma/client@6 @prisma/adapter-pg@6 pg --save-exact

# [3/5] Instalar el resto de dependencias
echo "[3/5] npm install resto de dependencias..."
npm install --ignore-scripts

# [4/5] Generar Prisma Client  
echo "[4/5] npx prisma generate..."
npx prisma generate

# [5/5] Compilar TypeScript
echo "[5/5] npm run build..."
npm run build

# Verificar build
if [ -f "dist/main.js" ]; then
    echo "=========================================="
    echo "Build completado!"
    echo "=========================================="
else
    echo "ERROR: build falló"
    exit 1
fi