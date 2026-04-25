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
npm install

# Verificar que se instalaron los types
echo "Verificando @types..."
ls node_modules/@types/ 2>/dev/null || echo "No hay @types"

# [2/4] Generar Prisma Client  
echo "[2/4] npx prisma generate..."
npx prisma generate

# [3/4] Compilar TypeScript
echo "[3/4] npm run build..."
npm run build

# [4/4] Verificar que se creó dist/
echo "[4/4] Verificando build..."
if [ -f "dist/main.js" ]; then
    echo "=========================================="
    echo "Build completado exitosamente!"
    echo "dist/main.js existe"
    echo "=========================================="
else
    echo "ERROR: dist/main.js no encontrado"
    ls -la dist/ 2>/dev/null || echo "dist/ no existe"
    exit 1
fi