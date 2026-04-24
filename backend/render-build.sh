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
npm install

# [2/4] Generar Prisma Client  
echo "[2/4] npx prisma generate..."
npx prisma generate

# [3/4] Compilar TypeScript con npx
echo "[3/4] npx nest build..."
npx nest build

# [4/4] Verificar que se creó dist/
if [ -f "dist/main.js" ]; then
    echo "=========================================="
    echo "Build completado!"
    echo "=========================================="
else
    echo "ERROR: dist/main.js no encontrado"
    exit 1
fi