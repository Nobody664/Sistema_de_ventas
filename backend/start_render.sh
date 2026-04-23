#!/bin/bash
# =============================================================================
# Script de despliegue para Render - Backend NestJS
# =============================================================================

set -e

echo "=========================================="
echo "Iniciando despliegue del backend..."
echo "=========================================="

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias..."
    npm install
fi

# Generar Prisma Client
echo "Generando Prisma Client..."
npx prisma generate

# Construir la aplicación
echo "Construyendo aplicación..."
npm run build

echo "=========================================="
echo "Despliegue completado exitosamente!"
echo "=========================================="