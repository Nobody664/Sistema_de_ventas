#!/usr/bin/env bash
set -e

echo "=== Installing dependencies (including devDependencies) ==="
npm ci --include=dev

echo "=== Generating Prisma client ==="
npx prisma generate

echo "=== Building application ==="
npm run build

echo "=== Build complete ==="
