# Testing Local - Sistema de Ventas

## Prerequisites

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install
```

## 1. Start Backend ( Puerto 4000 )

```bash
cd backend

# Terminal 1 - Start backend
npm run dev
```

### Test Backend Endpoints

```bash
# Health checks
curl http://localhost:4000/api/health/live
curl http://localhost:4000/api/health/ready

# Register new user
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!","fullName":"Test User"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!"}'

# Get Plans (public)
curl http://localhost:4000/api/plans
```

## 2. Start Frontend (Puerto 3000)

```bash
cd frontend

# Terminal 2 - Start frontend  
npm run dev
```

### Test Frontend

```
# Browser - Open
http://localhost:3000/sign-in
```

## Production URLs

| Service | URL |
|---------|-----|
| Backend (Render) | https://sistema-de-ventas-c6xb.onrender.com/api |
| Frontend (Vercel) | https://sistema-de-ventas-frontend-seven.vercel.app |

## Test Production Endpoints

```bash
# Backend health
curl https://sistema-de-ventas-c6xb.onrender.com/api/health/ready

# Backend login
curl -X POST https://sistema-de-ventas-c6xb.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@ventas-saas.local","password":"Admin123!"}'
```

## Troubleshooting

### "Connection refused"
- Verify backend is running on port 4000
- Check no other process using the port

### "CORS error"
- Backend will need frontend domain whitelisted
- Update CORS in src/main.ts

### "502 Origin unreachable"
- Backend server not running or crashed
- Check Render logs

### "Credentials incorrect"
- User doesn't exist or wrong password
- Use seed credentials: superadmin@ventas-saas.local / Admin123!

## Seed Credentials

| Email | Password | Role |
|-------|----------|------|
| superadmin@ventas-saas.local | Admin123! | SUPER_ADMIN |
| admin@acme.local | Admin123! | COMPANY_ADMIN |
| manager@acme.local | Admin123! | MANAGER |
| cajero@acme.local | Admin123! | CASHIER |