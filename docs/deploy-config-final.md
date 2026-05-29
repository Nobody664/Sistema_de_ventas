# Deploy Config — Sistema de Ventas

## Stack

| Layer | Provider | URL |
|-------|----------|-----|
| Database | Supabase PostgreSQL | `postgres.kvokpmfbufnuqhrubsuh` (pooler: `aws-1-sa-east-1.pooler.supabase.com`) |
| Backend | Render (Node) | `https://sistema-de-ventas-c6xb.onrender.com` |
| Frontend | Vercel (Next.js) | `https://sistema-de-ventas-frontend-seven.vercel.app` |

---

## Backend (Render)

### Service

| Field | Value |
|-------|-------|
| Name | `Sistema_de_ventas` |
| ID | `srv-d7krae2qqhas738e0ts0` |
| Root dir | `backend` |
| Runtime | Node |
| Region | Oregon |
| Plan | Free |
| Health check | `/api/health/ready` |
| Auto-deploy | **OFF** (enable manually) |

### Key Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | `postgresql://postgres.kvokpmfbufnuqhrubsuh:***@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require` | Runtime DB (transaction pooler) |
| `DIRECT_URL` | `postgresql://postgres.kvokpmfbufnuqhrubsuh:***@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require` | Prisma Migrate (session pooler) |
| `JWT_ACCESS_SECRET` | `1037025e8c19352d69bb857d837ace54` | JWT signing |
| `JWT_REFRESH_SECRET` | `bfbca9a3ec1f497e18eb6ff68f08f6a8` | JWT refresh |
| `REDIS_URL` | `rediss://default:***@national-quagga-107613.upstash.io:6379` | Cache/Queue |

### Prisma PgBouncer Config

- `relationMode = "prisma"` in schema.prisma
- `DATABASE_URL` → port 6543 with `?pgbouncer=true` (transaction pooler — runtime)
- `DIRECT_URL` → port 5432 without `?pgbouncer=true` (session pooler — migrations)

### Startup

The app uses `npm run start` → `node dist/main.js`. A `start.sh` script was created that runs `prisma db push` before starting. To activate it, change the start command in the Render Dashboard to `bash start.sh`.

---

## Frontend (Vercel)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://sistema-de-ventas-c6xb.onrender.com/api` |
| `NEXTAUTH_URL` | `https://sistema-de-ventas-frontend-seven.vercel.app` |
| `NEXTAUTH_SECRET` | `access_secret_ventas_2026` |

---

## Files Changed

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Added `directUrl = env("DIRECT_URL")` |
| `render.yaml` | Updated DATABASE_URL, added DIRECT_URL, corrected JWT secrets |
| `backend/start.sh` | New file — runs `prisma db push` then starts the app |

---

## Manual Steps Needed

1. **Delete `sass_ventas` service** — duplicate/broken service at `https://sass-ventas.onrender.com`. Go to Render Dashboard → `sass_ventas` → Settings → Delete Service.
2. **Update start command** — In Render Dashboard → `Sistema_de_ventas` → Settings → change Start Command from `npm run start` to `bash start.sh`.
3. **Enable auto-deploy** — In Render Dashboard → `Sistema_de_ventas` → Settings → Auto-Deploy → Yes.
4. **Push changes to GitHub** — Commit and push `render.yaml`, `start.sh`, and `schema.prisma` so the IaC config matches.
