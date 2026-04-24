#!/bin/bash
# =============================================================================
# Render Build Script - Sistema de Ventas Backend
# =============================================================================

set -e

echo "=========================================="
echo "Iniciando build para Render..."
echo "=========================================="

# Instalar dependencias
echo "[1/4] Instalando dependencias..."
npm install

# Generar Prisma Client
echo "[2/4] Generando Prisma Client..."
npx prisma generate

# Compilar TypeScript
echo "[3/4] Compilando TypeScript..."
npm run build

echo "[4/4] Build completado!"
echo "=========================================="
echo "Listo para iniciar el servidor"
echo "=========================================="