#!/bin/bash
set -e

echo "=== Running Prisma db push ==="
npx prisma db push --skip-generate \
  && echo "✅ Database schema synced" \
  || echo "⚠️ Database push failed (non-fatal, continuing...)"
echo ""

echo "=== Starting application ==="
echo "Node version: $(node -v)"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "PORT: ${PORT:-not set}"
echo "DATABASE_URL: ${DATABASE_URL:+set (${#DATABASE_URL} chars)}"
echo "DIRECT_URL: ${DIRECT_URL:+set (${#DIRECT_URL} chars)}"
echo "JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:+set (${#JWT_ACCESS_SECRET} chars)}"
echo "REDIS_URL: ${REDIS_URL:+set (${#REDIS_URL} chars)}"
echo "SMTP_ENABLED: ${SMTP_ENABLED:-not set}"
echo ""

node dist/main.js
