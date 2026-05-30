#!/bin/bash

echo "=== Running Prisma db push ==="
npx prisma db push --skip-generate \
  && echo "✅ Database schema synced" \
  || echo "⚠️ Database push failed (non-fatal, continuing...)"
echo ""

echo "=== Checking build output ==="
if [ ! -f dist/main.js ]; then
  echo "❌ dist/main.js not found! Build may have failed."
  echo "Contents of dist/:"
  ls -la dist/ 2>/dev/null || echo "(dist/ does not exist)"
  exit 1
fi
echo "✅ dist/main.js found"
echo ""

echo "=== Starting application ==="
echo "Node version: $(node -v)"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "PORT: ${PORT:-not set}"
echo ""

node dist/main.js
