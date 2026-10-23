#!/bin/bash
# Clean build script for Next.js frontend

echo "🧹 Limpiando cache de Next.js..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .tsbuildinfo

echo "✅ Cache limpiado"
echo ""
echo "🏗️ Ejecutando build..."
npm run build