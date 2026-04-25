#!/bin/bash
# =============================================================================
# Render Build Script - Sistema de Ventas Backend (Prisma 7)
# =============================================================================

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "Iniciando build para Render..."
echo "Node version: $(node --version)"
echo "=========================================="

# Obtener DATABASE_URL desde variable de entorno de Render
DB_URL="${DATABASE_URL}"

if [ -z "$DB_URL" ]; then
    echo "ERROR: DATABASE_URL no está definida"
    exit 1
fi

echo "Prisma version a usar: 7.x"

# [1/4] Instalar dependencias
echo "[1/4] npm install..."
npm install --include=dev

# [2/4] Generar Prisma Client con URL directa
echo "[2/4] npx prisma generate..."
npx prisma generate --url "$DB_URL"

# [3/4] Compilar
echo "[3/4] npm run build..."
npm run build

# [4/4] Verificar
if [ -f "dist/main.js" ]; then
    echo "=========================================="
    echo "Build OK!"
    echo "=========================================="
else
    echo "ERROR: build failed"
    exit 1
fi