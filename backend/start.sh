#!/usr/bin/env sh
set -eu

echo "=== Applying pending migrations (baseline) ==="
npx prisma migrate deploy

if [ "${SEED_ON_DEPLOY:-false}" = "true" ]; then
  echo "=== Seeding base catalog (idempotent, no borra datos) ==="
  npx prisma db seed
fi

exec npm run start