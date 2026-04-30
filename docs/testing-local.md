# Testing Local - Sistema de Ventas

## Quick Start

### Terminal 1 - Start Backend (Puerto 4000)

```bash
cd backend
npm install  # Only first time
npm run dev
```

### Terminal 2 - Start Frontend (Puerto 3000)

```bash
cd frontend
npm run dev
```

## Test Endpoints

```bash
# Health checks
curl http://localhost:4000/api/health/live
curl http://localhost:4000/api/health/ready

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@ventas-saas.local","password":"Admin123!"}'

# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"new@test.com","password":"Test1234!","fullName":"New User"}'

# Get Plans (public)
curl http://localhost:4000/api/plans
```

## Credenciales Seed

| Email | Password | Role |
|-------|----------|------|
| superadmin@ventas-saas.local | Admin123! | SUPER_ADMIN |
| admin@acme.local | Admin123! | COMPANY_ADMIN |
| manager@acme.local | Admin123! | MANAGER |
| cajero@acme.local | Admin123! | CASHIER |

## Production URLs

| Service | URL |
|--------|-----|
| Backend | https://sistema-de-ventas-c6xb.onrender.com/api |
| Frontend | https://sistema-de-ventas-frontend-seven.vercel.app |

## Production Test

```bash
curl https://sistema-de-ventas-c6xb.onrender.com/api/health/ready

curl -X POST https://sistema-de-ventas-c6xb.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@ventas-saas.local","password":"Admin123!"}'
```