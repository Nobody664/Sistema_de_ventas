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

# [1/4] Instalar dependencias
echo "[1/4] npm install..."
npm install --include=dev

# [2/4] Verificar versión de Prisma
echo ""
echo "[2/4] Verificando Prisma..."
npx prisma --version

# [3/4] Generar Prisma Client
echo ""
echo "[3/4] npx prisma generate..."
npx prisma generate

# [4/4] Compilar
echo ""
echo "[4/4] npm run build..."
npm run build

if [ -f "dist/main.js" ]; then
    echo "=========================================="
    echo "Build OK!"
    echo "=========================================="
else
    echo "ERROR: build failed"
    exit 1
fi